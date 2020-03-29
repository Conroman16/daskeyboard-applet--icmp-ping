const q = require('daskeyboard-applet');
const childprocess = require('child_process');
const tinygradient = require('tinygradient');
const logger = q.logger;
const ICMPPingDefaults = {
	PollingIntervalSeconds: 60,	// Number of seconds between polling sessions
	PingCount: 5,				// Number of pings to send per polling session
	MinimumPing: 30,			// Threshold below which everything is considered 'green'
	MaximumPing: 1000,      // Threshold below which everything is considered 'yellow'
	FastColor: '#00ff00',	// Default color where an action has been successful
	SlowColor: '#ffff00',	// Default color where an action has been successful
	FailureColor: '#ff0000'		// Default color when there has been a failure
};

class ICMPPing extends q.DesktopApp {
	constructor() {
		super();
	}

	async run() {
		return new Promise((resolve, reject) => {
			this.ping(this.config.pingAddress)
				.then(avgResponseTime => {
					if ((avgResponseTime >= 0))
						resolve(this.buildSignal(this.config.pingAddress, this.getColor(avgResponseTime), avgResponseTime));
					else
						resolve(this.buildSignal(this.config.pingAddress, this.config.failureColor || ICMPPingDefaults.FailureColor, avgResponseTime));
				})
				.catch(err => {
					logger.error(`Error while pinging ${this.config.pingAddress}: ${err}`);
					resolve(this.buildSignal(this.config.pingAddress, this.config.failureColor || ICMPPingDefaults.FailureColor, null, err));
				});
		});
	}

	async applyConfig() {
		this.pollingInterval = 1000 * this.pollingIntervalSeconds;
		this.gradient = tinygradient([this.config.fastColor || ICMPPingDefaults.FastColor, this.config.slowColor || ICMPPingDefaults.SlowColor]);
	}

	get pollingIntervalSeconds() {
		return (this.config.pollingIntervalSeconds || ICMPPingDefaults.PollingIntervalSeconds) * 1;
	}

	get pingCount() {
		return (this.config.pingCount || ICMPPingDefaults.PingCount) * 1;
	}

	get minPing() {
		return (this.config.minimumPing || ICMPPingDefaults.MinumumPing) * 1;
	}

	get maxPing() {
		return (this.config.maximumPing || ICMPPingDefaults.MaximumPing) * 1;
	}

	get isWindows() {
		return process.platform === 'win32';
	}

	getColor(avgResponseTime) {
		const min = this.minPing;
		const max = this.maxPing;

		if (max <= min)
			return this.config.fastColor || ICMPPingDefaults.FastColor;

		if (avgResponseTime < min)
			avgResponseTime = min;
		if (avgResponseTime > max)
			avgResponseTime = max;

		const range = this.config.useLogarithmicScale
			// max > min, but when diff is 1ms we'll receive 0 as Log result
			? Math.log2(Math.max(avgResponseTime - min, 1)) / Math.log2(Math.max(max - min, 1))
			: (avgResponseTime - min) / (max - min);

		return this.gradient.rgbAt(range).toHexString();
	}

	async ping(address, count) {
		let pingCount = !!count ? count : this.pingCount;
		let pingCountArg = this.isWindows ? '-n' : '-c';
		return new Promise((resolve, reject) => {
			childprocess.exec(`ping ${address} ${pingCountArg} ${pingCount}`, (err, stdout, stderr) => {
				if (err) {
					logger.warn(`Error while executing ping: ${err}`);
					reject(err);
					return;
				}
				const times = stdout.match(/time[=<]\d+(\.\d+)?/g);
				if (times == null || times.length === 0) {
					resolve(-1);
					return;
				}
				const pingTimesSum = times.map((el) => parseFloat(el.substr('time='.length))).reduce((a, b) => a + b, 0);

				resolve(pingTimesSum / times.length);
			});
		});
	}

	buildSignal(address, color, avgResponseTime, err) {
		if (err != null || avgResponseTime < 0 || avgResponseTime == null) {
			return new q.Signal({
				points: [[new q.Point(color, this.config.blinkOnError ? q.Effects.BLINK : q.Effects.SET_COLOR)]],
				name: 'ICMP Ping',
				message: `Error while pinging ${address}`
			});
		}

		return new q.Signal({
			points: [[new q.Point(color)]],
			name: 'ICMP Ping',
			message: `Average response time for ${address}: ${avgResponseTime.toFixed(2)}ms`
		});
	}
}

module.exports = {
	ICMPPing: ICMPPing
};

const icmpPing = new ICMPPing();
