const q = require('daskeyboard-applet');
const childprocess = require('child_process');
const defaultPollingIntervalSeconds = 60;
const defaultPingCount = 5;
const failColor = '#ff0000';
const logger = q.logger;

class PingTime extends q.DesktopApp {
	constructor() {
		super();
		this.pollingInterval = 1000 * this.getPollingInterval();
		logger.info("ICMP Ping applet initialized");
	}

	async run() {
		const $this = this;
		return $this.getPingAddress()
			.then(address => $this.ping(address))
			.then(avgResponseTime => PingTime.buildSignal(avgResponseTime, $this.getColor(avgResponseTime)))
			.catch(err => {
				logger.warn(err);
				PingTime.buildSignal(failColor, err);
			});
	}

    async applyConfig() {
        const $this = this;
        return $this.getPingAddress()
            .then(address => PingTime.ping(address))
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
		if (avgResponseTime <= 10)
			color = "#2ecc71";
		else if (avgResponseTime > 20 && avgResponseTime <= 35)
			color = '#27ae60';
		else if (avgResponseTime > 35 && avgResponseTime <= 50)
			color = '#f1c40f';
		else if (avgResponseTime > 50 && avgResponseTime <= 65)
			color = '#f39c12';
		else if (avgResponseTime > 65 && avgResponseTime <= 80)
			color = '#e67e22';
		else if (avgResponseTime > 80 && avgResponseTime <= 95)
			color = '#c0392b';
		else if (avgResponseTime > 95 && avgResponseTime <= 110)
			color = '#9b59b6';
		else if (avgResponseTime > 110)
			color = '#8e44ad';
		return color;
	}

    async ping(address){
    	let pingCount = this.getPingCount();
		return new Promise((resolve, reject) => {
			// childprocess.exec(`ping ${address} -c ${pingCount}|awk '{print $8}'|head -n ${pingCount + 1}|tail -n ${pingCount}|sed 's/time=//g'`, (err, stdout, stderr) => {
			childprocess.exec(`ping ${address} -c ${pingCount}`, (err, stdout, stderr) => {
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

    static buildSignal(avgResponseTime, color) {
        return new q.Signal({
            points: [
                [new q.Point(color)]
            ],
            name: `ICMP Ping`,
            message: `Average response time: ${avgResponseTime.toFixed(2)}ms`
        });
    }
}

module.exports = {
  PingTime: PingTime
};

const pingTime = new PingTime();