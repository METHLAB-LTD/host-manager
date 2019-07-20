'use strict';

import Store from '@/store';

import { nodeRequire } from '@/utils';

const request = nodeRequire('request');

function sendJSONRequest(url, method, body) {
	return new Promise((resolve, reject) => {
		url = `${Store.state.config.siad_api_addr}${url}`;

		if (url.indexOf('http') < 0)
			url = `http://${url}`;

		const opts = {
			method,
			headers: {
				'User-Agent': Store.state.config.siad_api_agent
			},
			auth: {
				username: '',
				password: Store.state.config.siad_api_password
			}
		};

		if (method === 'POST' && body)
			opts.form = body;

		request(url, opts, (err, resp, body) => {
			if (err)
				return reject(err);

			const r = { ...resp.toJSON() };

			if (resp.statusCode === 200)
				r.body = JSON.parse(body);

			if (r.statusCode >= 200 && r.statusCode < 300)
				r.statusCode = 200;

			resolve(r);
		});
	});
}

export function getConsensus() {
	return sendJSONRequest('/consensus', 'GET', null);
}

export function getContracts() {
	return sendJSONRequest('/host/contracts', 'GET', null);
}

export function getHost() {
	return sendJSONRequest('/host', 'GET', null);
}

export function getHostStorage() {
	return sendJSONRequest('/host/storage', 'GET', null);
}

export function getWallet() {
	return sendJSONRequest('/wallet', 'GET', null);
}

export function updateHost(config) {
	return sendJSONRequest('/host', 'POST', config);
}

export function removeStorageFolder(path, force) {
	const opts = {
		path
	};

	if (force && typeof force === 'boolean')
		opts['force'] = 'true';

	return sendJSONRequest('/host/storage/folders/remove', 'POST', opts);
}