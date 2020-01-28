const q = require('daskeyboard-applet');
const childprocess = require('child_process');
const tinygradient = require('tinygradient');
const logger = q.logger;
const ICMPPingDefaults = {
	PollingIntervalSeconds: 60,	// Number of seconds between polling sessions
	PingCount: 5,				// Number of pings to send per polling session
	MinimumPing: 30,			// Threshold below which everything is considered 'green'
	ColorScalingInterval: 30,	// Time gap in milliseconds between colors
	GradientStops: 8,			// Default granularity of gradient to be calculated
	SuccessColor: '#00ff00',	// Default color where an action has been successful
	FailureColor: '#ff0000'		// Default color when there has been a failure
};

class ICMPPing extends q.DesktopApp {
	constructor() {
		super();
	}

	async run() {
		return new Promise((resolve, reject) => {
			this.ping(this.config.pingAddress)
				.then(avgResponseTime => resolve(ICMPPing.buildSignal(this.config.pingAddress, this.getColor(avgResponseTime), avgResponseTime)))
				.catch(err => {
					logger.error(`Error while pinging ${this.config.pingAddress}: ${err}`);
					return reject(ICMPPing.buildSignal(this.config.pingAddress, ICMPPingDefaults.FailureColor, null, err));
				});
		});
	}

	async applyConfig() {
		this.pollingInterval = 1000 * this.pollingIntervalSeconds;
		this.gradientArray = this.generateGradientArray();
	}

	get pollingIntervalSeconds(){
		return JSON.parse(this.config.pollingIntervalSeconds || ICMPPingDefaults.PollingIntervalSeconds);
	}

	get pingCount(){
		return JSON.parse(this.config.pingCount || ICMPPingDefaults.PingCount);
	}

	get minPing(){
		return JSON.parse(this.config.minimumPing || ICMPPingDefaults.MinimumPing);
	}

	get colorScalingInterval(){
		return JSON.parse(this.config.colorScalingInterval || ICMPPingDefaults.ColorScalingInterval);
	}

	get gradientStops(){
		return JSON.parse(this.config.gradientStops || ICMPPingDefaults.GradientStops);
	}

	get fastColor(){
		return this.config.fastColor || ICMPPingDefaults.SuccessColor;
	}

	get slowColor(){
		return this.config.slowColor || ICMPPingDefaults.FailureColor;
	}

	get isXClockwiseGradient(){
		return !!this.config.counterClockwiseGradient;
	}

	get isWindows(){
		return process.platform == 'win32';
	}

	getColor(avgResponseTime) {
		const minPing = this.minPing;
		const scalingInterval = this.colorScalingInterval;
		let arrIndx = Math.floor(Math.abs(((avgResponseTime - minPing) / scalingInterval) + 1));
		return this.gradientArray[arrIndx < this.gradientArray.length ? arrIndx : this.gradientArray.length - 1];
	}

	generateGradientArray(){
		let gradient = tinygradient([ // Define a simple gradient between the two colors
			{ color: this.fastColor, pos: 0 },	// Fast color first as we calculate
			{ color: this.slowColor, pos: 1 }	// from fast->slow when selecting colors
		]);
		// Calculate array of points on gradient for key colors and convert them to hex
		return gradient.hsv(this.gradientStops, this.isXClockwiseGradient).map((el) => el.toHexString());
	}

	async ping(address, count){
		let pingCount = !!count ? count : this.pingCount;
		let pingCountArg = this.isWindows ? '-n' : '-c';
		return new Promise((resolve, reject) => {
			childprocess.exec(`ping ${address} ${pingCountArg} ${pingCount}`, (err, stdout, stderr) => {
				if (err){
					logger.warn(`Error while executing ping: ${err}`);
					return reject(err);
				}
				let pingTimes = [], times = stdout.match(/time=\d+(\.\d+)*/g);
				times.forEach((el) => pingTimes.push(el.replace('time=', '')));
				let pingAverage = pingTimes.reduce((a, b) => JSON.parse(a) + JSON.parse(b), 0) / pingTimes.length;
				if (!pingAverage)
					return reject(`Unable to calculate ping due to invalid ping time data: ${times.replace(/(?:\r\n|\r|\n)/g, ' ')}`);
				return resolve(pingAverage);
			});
		});
	}

	static buildSignal(address, color, avgResponseTime, err) {
		if (typeof err !== 'undefined' || avgResponseTime == null){
			return q.Signal.error([`Error while pinging ${address}`]);
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
