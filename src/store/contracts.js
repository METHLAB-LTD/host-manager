export default {
	namespaced: true,
	state: {
		stats: {},
		alerts: [],
		snapshots: {},
		newAlertsCount: 0
	},
	mutations: {
		setStats(state, stats) {
			state.stats = stats;
		},
		setSnapshots(state, snapshots) {
			state.snapshots = snapshots;
		},
		setAlerts(state, alerts) {
			state.newAlertsCount = alerts.reduce((val, alert) => {
				const match = state.alerts.find(existing => existing.id ? existing.id === alert.id : existing.message === alert.message);

				if (match)
					return val;

				return val + 1;
			}, 0);

			state.alerts = alerts;
		}
	},
	actions: {
		setStats(context, stats) {
			context.commit('setStats', stats);
		},
		setSnapshots(context, snapshots) {
			context.commit('setSnapshots', snapshots);
		},
		setAlerts(context, alerts) {
			context.commit('setAlerts', alerts);
		}
	},
	getters: {
		snapshots(state) {
			const keys = Object.keys(state.snapshots),
				snapshots = [];

			keys.forEach(k => {
				snapshots.push(state.snapshots[k]);
			});

			snapshots.sort((a, b) => a.timestamp.getTime() > b.timestamp.getTime() ? 1 : a.timestamp.getTime() < b.timestamp.getTime() ? -1 : 0);

			console.log(snapshots);

			return snapshots;
		}
	}
};