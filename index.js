const q = require('daskeyboard-applet');
const childprocess = require('child_process');
const defaultPollingIntervalSeconds = 60;
const defaultPingCount = 5;
const failColor = '#ff0000';
const logger = q.logger;

class ICMPPing extends q.DesktopApp {
	constructor() {
		super();
		this.pollingInterval = 1000 * this.getPollingInterval();
		logger.info("ICMP Ping applet initialized");
	}

	async run() {
		const $this = this;
		return $this.getPingAddress()
			.then(address => $this.ping(address))
			.then(avgResponseTime => ICMPPing.buildSignal($this.config.pingAddress, avgResponseTime, $this.getColor(avgResponseTime)))
			.catch(err => {
				logger.warn(err);
				ICMPPing.buildSignal($this.config.pingAddress, failColor, err);
			});
	}

	async applyConfig() {
		const $this = this;
		return $this.getPingAddress()
			.then(address => $this.ping(address, 1))
			.then(data => logger.info('Configuration updated'))
			.catch(err => {
				logger.warn(`Error while applying configuration: ${err}`);
				return false;
			});
	}

	async getPingAddress() {
		return this.config.pingAddress ?
			Promise.resolve(this.config.pingAddress) :
			Promise.reject();
	}

	getPollingInterval() {
		return JSON.parse(this.config.pollingIntervalSeconds ?
			this.config.pollingIntervalSeconds :
			defaultPollingIntervalSeconds);
	}

	getPingCount(){
		return JSON.parse(this.config.pingCount ?
			this.config.pingCount :
			defaultPingCount);
	}

	getColor(avgResponseTime) {
		let color = '#ffffff';
		if (avgResponseTime <= 30)
			color = "#00ff00";
		else if (avgResponseTime > 30 && avgResponseTime <= 50)
			color = '#48ff00';
		else if (avgResponseTime > 50 && avgResponseTime <= 70)
			color = '#91ff00';
		else if (avgResponseTime > 70 && avgResponseTime <= 90)
			color = '#daff00';
		else if (avgResponseTime > 90 && avgResponseTime <= 110)
			color = '#ffad00';
		else if (avgResponseTime > 110 && avgResponseTime <= 130)
			color = '#ff9100';
		else if (avgResponseTime > 130 && avgResponseTime <= 150)
			color = '#ff4800';
		else if (avgResponseTime > 150)
			color = '#ff0000';
		return color;
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
				logger.info(`Average response time for ${address} is ${pingAverage.toFixed(2)}ms`)
				return resolve(pingAverage);
			});
		});
	}

	static buildSignal(address, avgResponseTime, color) {
		return new q.Signal({
			points: [[new q.Point(color)]],
				name: `ICMP Ping`,
				message: `Average response time for ${address}: ${avgResponseTime.toFixed(2)}ms`
			});
		}
	}

module.exports = {
	ICMPPing: ICMPPing
};

const icmpPing = new ICMPPing();
