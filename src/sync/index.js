import log from 'electron-log';

import { refreshBlockHeight, refreshLastBlock, refreshDaemonVersion } from './consensus';
import { refreshHostContracts } from './contracts';
import { refreshHostStorage } from './storage';
import { refreshHostWallet } from './wallet';
import { refreshHostConfig } from './config';
import { refreshExplorer } from './explorer';
import { getCoinPrice, getBootstrapPeers } from '@/api/siacentral';
import { parseCurrencyString } from '@/utils/parseLegacy';
import Store from '@/store';
import SiaApiClient from '@/api/sia';

let longTimeout, shortTimeout, loadingLong, loadingShort, priceTimeout;

export let apiClient;

export async function refreshData(config) {
	apiClient = new SiaApiClient(config || Store.state.config);
	const credentialsValid = await apiClient.checkCredentials();

	if (!credentialsValid)
		throw new Error('API credentials invalid');

	Store.dispatch('setRefreshingData', true);

	await refreshLastBlock();
	await longRefresh();
	await shortRefresh();
	await refreshCoinPrice();

	Store.dispatch('setLoaded', true);
	Store.dispatch('setRefreshingData', false);
}

async function shortRefresh() {
	if (loadingShort)
		return;

	try {
		loadingShort = true;

		clearTimeout(shortTimeout);

		await Promise.allSettled([
			refreshDaemonVersion(),
			refreshBlockHeight(),
			refreshHostWallet(),
			refreshHostStorage()
		]);
	} catch (ex) {
		log.error('data refresh - short', ex.message);
	} finally {
		loadingShort = false;
		shortTimeout = setTimeout(shortRefresh, 5000);
	}
}

async function longRefresh() {
	if (loadingLong)
		return;

	try {
		loadingLong = true;

		clearTimeout(longTimeout);

		await Promise.allSettled([
			refreshLastBlock(),
			refreshHostConfig(),
			refreshHostContracts(),
			checkPeers()
		]);

		// refresh explorer relies on host config call being completed
		await refreshExplorer();
		window.gc();
	} catch (ex) {
		log.error('data refresh - long', ex.message);
	} finally {
		loadingLong = false;
		longTimeout = setTimeout(longRefresh, 300000);
	}
}

function getSCValue(key, pin) {
	const byteFactor = Store.state.config && Store.state.config.data_unit === 'decimal' ? 1e12 : 1099511627776;

	const { value, currency } = pin;

	switch (key) {
	// per tb / month
	case 'minstorageprice':
	case 'collateral':
		return parseCurrencyString(value, currency).div(byteFactor).div(4320);
	// per tb
	case 'mindownloadbandwidthprice':
	case 'minuploadbandwidthprice':
		return parseCurrencyString(value, currency).div(byteFactor);
	// sc
	default:
		return parseCurrencyString(value, currency);
	}
}

async function updatePinnedPricing() {
	try {
		if (!Store.state.config || !Store.state.config.host_pricing_pins)
			return;

		let changed = false,
			newConfig = {};

		for (let pin in Store.state.config.host_pricing_pins) {
			try {
				if (!Store.state.config.host_pricing_pins || !Store.state.config.host_pricing_pins[pin] ||
					typeof Store.state.config.host_pricing_pins[pin].value !== 'string')
					continue;

				const value = getSCValue(pin, Store.state.config.host_pricing_pins[pin]),
					newValue = value.toFixed(0),
					currentValue = Store.state.hostConfig.config[pin].toFixed(0);

				if (currentValue === undefined || newValue === undefined || newValue === currentValue)
					continue;

				// removed the max collateral setting from config
				if (pin === 'maxcollateral')
					continue;

				if (pin === 'collateral') {
					newConfig['maxcollateral'] = value.times(1e12).times(4).times(4320).times(6).toFixed(0);
					log.debug('maxcollateral', newConfig['maxcollateral']);
				}

				log.debug('updated', pin, 'from', currentValue, 'to', newValue);

				newConfig[pin] = newValue;
				changed = true;
			} catch (ex) {
				log.error('unable to set pricing for', pin, ex.message);
				throw new Error(`unable to set pricing for ${pin}. Check error logs for more information.`);
			}
		}

		if (!changed)
			return true;

		newConfig.windowsize = 144;

		await apiClient.updateHost(newConfig);
		await refreshHostConfig();
	} catch (ex) {
		log.error('update pinned pricing', ex.message);
	}
}

async function refreshCoinPrice() {
	try {
		clearTimeout(priceTimeout);

		const prices = await getCoinPrice();

		Store.dispatch('setCoinPrice', prices);
		await updatePinnedPricing();
	} catch (ex) {
		log.error('refreshCoinPrice', ex.message);
	} finally {
		priceTimeout = setTimeout(refreshCoinPrice, 1000 * 60 * 15);
	}
}

export async function checkPeers() {
	try {
		const g = await apiClient.gateway();

		if (Array.isArray(g.peers) && g.peers.length > 1)
			return;

		const peers = await getBootstrapPeers(),
			promises = [];
		for (let i = 0; i < peers.length; i++)
			promises.push(apiClient.gatewayConnect(peers[i]));

		await Promise.allSettled(promises);
	} catch (ex) {
		log.warn('checkPeers', ex.message);
	}
}