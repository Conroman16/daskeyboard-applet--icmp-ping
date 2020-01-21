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
	FailureColor: '#ff0000'//,	// Default color when there has been a failure
};

class ICMPPing extends q.DesktopApp {
	constructor() {
		super();
		this.pollingInterval = 1000 * this.getPollingIntervalSeconds();
		this.gradientArray = this.generateGradientArray();
		logger.info("ICMP Ping applet initialized");
	}

	async run() {
		return this.getPingAddress()
			.then(address => this.ping(address))
			.then(avgResponseTime => ICMPPing.buildSignal(this.config.pingAddress, this.getColor(avgResponseTime), avgResponseTime))
			.catch(err => {
				logger.error(`Error while pinging ${this.config.pingAddress}: ${err}`);
				return ICMPPing.buildSignal(this.config.pingAddress, ICMPPingDefaults.FailureColor, null, err);
			});
	}

	async applyConfig() {
		return this.getPingAddress()
			.then(address => this.ping(address, 1))
			.then(data => logger.info('Configuration updated'))
			.catch(err => {
				logger.error(`Error while applying configuration: ${err}`);
				return false;
			});
	}

	async getPingAddress() {
		return this.config.pingAddress ?
			Promise.resolve(this.config.pingAddress) :
			Promise.reject();
	}

	getPollingIntervalSeconds() {
		return JSON.parse(this.config.pollingIntervalSeconds || ICMPPingDefaults.PollingIntervalSeconds);
	}

	getPingCount(){
		return JSON.parse(this.config.pingCount || ICMPPingDefaults.PingCount);
	}

	getMinPing(){
		return JSON.parse(this.config.minimumPing || ICMPPingDefaults.MinimumPing);
	}

	getColorScalingInterval(){
		return JSON.parse(this.config.colorScalingInterval || ICMPPingDefaults.ColorScalingInterval);
	}

	getGradientStops(){
		return JSON.parse(this.config.gradientStops || ICMPPingDefaults.GradientStops);
	}

	getFastColor(){
		return this.config.fastColor || ICMPPingDefaults.SuccessColor;
	}

	getSlowColor(){
		return this.config.slowColor || ICMPPingDefaults.FailureColor;
	}

	isXClockwiseGradient(){
		return !!this.config.counterClockwiseGradient;
	}

	getColor(avgResponseTime) {
		const minPing = this.getMinPing();
		const scalingInterval = this.getColorScalingInterval();
		let arrIndx = Math.floor(Math.abs(((avgResponseTime - minPing) / scalingInterval) + 1))
		return this.gradientArray[arrIndx < this.gradientArray.length ? arrIndx : this.gradientArray.length - 1];
	}

	generateGradientArray(){
		let gradient = tinygradient([ // Define a simple gradient between the two colors
			{ color: this.getFastColor(), pos: 0 },	// Fast color first as we calculate
			{ color: this.getSlowColor(), pos: 1 }	// from fast->slow when selecting colors
		]);
		// Calculate array of points on gradient for key colors and convert them to hex
		return gradient.hsv(this.getGradientStops(), this.isXClockwiseGradient()).map((el) => el.toHexString());
	}

	isWindows(){
		return process.platform == 'win32';
	}

	async ping(address, count){
		let pingCount = !!count ? count : this.getPingCount();
		let pingCountArg = this.isWindows() ? '-n' : '-c';
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
				logger.info(`Average response time for ${address} is ${pingAverage.toFixed(2)}ms`)
				return resolve(pingAverage);
			});
		});
	}

	static buildSignal(address, color, avgResponseTime, err) {
		if ( !(typeof err === 'undefined') || (avgResponseTime == null)){
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
