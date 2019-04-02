const q = require('daskeyboard-applet');
const childprocess = require('child_process');
const logger = q.logger;
const ICMPPingDefaults = {
	PollingIntervalSeconds: 60,	// Number of seconds between polling sessions
	PingCount: 5,				// Number of pings to send per polling session
	MinimumPing: 30,			// Threshold below which everything is considered 'green'
	ColorScalingInterval: 30,	// Time gap in milliseconds between colors
	FailureColor: '#ff0000',	// Default color when there has been a failure
	LedColors: ['#00ff00', '#48ff00', '#91ff00', '#daff00',	// Supported colors IN ORDER from green to red
				'#ffad00', '#ff9100', '#ff4800', '#ff0000']
};

class ICMPPing extends q.DesktopApp {
	constructor() {
		super();
		this.pollingInterval = 1000 * this.getPollingIntervalSeconds();
		logger.info("ICMP Ping applet initialized");
	}

	async run() {
		const $this = this;
		return $this.getPingAddress()
			.then(address => $this.ping(address))
			.then(avgResponseTime => ICMPPing.buildSignal($this.config.pingAddress, $this.getColor(avgResponseTime), avgResponseTime))
			.catch(err => {
				logger.error(`Error while pinging ${$this.config.pingAddress}: ${err}`);
				return ICMPPing.buildSignal($this.config.pingAddress, ICMPPingDefaults.FailureColor, null, err);
			});
	}

	async applyConfig() {
		const $this = this;
		return $this.getPingAddress()
			.then(address => $this.ping(address, 1))
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
		return JSON.parse(this.config.pollingIntervalSeconds ?
			this.config.pollingIntervalSeconds :
			ICMPPingDefaults.PollingIntervalSeconds);
	}

	getPingCount(){
		return JSON.parse(this.config.pingCount ?
			this.config.pingCount :
			ICMPPingDefaults.PingCount);
	}

	getMinPing(){
		return JSON.parse(this.config.minimumPing ?
			this.config.minimumPing :
			ICMPPingDefaults.MinimumPing);
	}

	getColorScalingInterval(){
		return JSON.parse(this.config.colorScalingInterval ?
			this.config.colorScalingInterval :
			ICMPPingDefaults.ColorScalingInterval);
	}

	getColorList(){
		return this.config.colors || ICMPPingDefaults.Colors;

	}

	getColor(avgResponseTime) {
		const colors = this.getColorList();
		const minPing = this.getMinPing();
		const scalingInterval = this.getColorScalingInterval();
		let arrIndx = Math.floor(Math.abs(((avgResponseTime - minPing) / scalingInterval) + 1))
		return colors[arrIndx < colors.length ? arrIndx : colors.length - 1];
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
