const assert = require('assert');
const ICMPPing = require('../index').ICMPPing;
const pingAddress = 'cloudflare.com';

function getDefaultConfig() {
	return {
		applet: {
			defaults: {
				pingAddress: pingAddress,
				fastColor: '#00ff00',
				slowColor: '#ff0000',
				counterClockwiseGradient: true,
				gradientStops: 8,
				pollingIntervalSeconds: 60,
				pingCount: 1,
				minimumPing: 30,
				colorScalingInterval: 30
			}
		}
	};
}

describe('ICMP Ping: #run()', () => {
	it(`Ping ${pingAddress}`, async () => {
		let config = getDefaultConfig();
		let app = new ICMPPing();
		await app.processConfig(config);
		return app.run()
			.then((signal) => assert.ok(signal.points[0][0].color))
			.catch((err) => assert.fail(err));

	});
});
