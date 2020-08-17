const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const stateAdapter = require('../../states/stateAdapter');
const Progress = require('../core/progress');
const Adapters = require('../adapters/adapters');
const { Components, streamingEvents } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

/**
* Ratio example:
* ratio = (req msgPer sec / res msgPer sec)
* (300 / 120) = 2.5
* If the response is 2.5 times slower than request
* So we need to scale up current replicas * 2.5
* If the ratio is 0.5 we need to scale down.
* The desired ratio is approximately 1 (0.8 <= desired <= 1.2)
*/

class AutoScaler extends EventEmitter {
    init(options) {
        this._options = options.streaming.autoScaler;
        log = Logger.GetLogFromContainer();
    }

    async start(jobData) {
        this._jobData = jobData;
        this._adapters = new Adapters();
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._progress = new Progress();
        this._progress.on(streamingEvents.PROGRESS_CHANGED, (changes) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changes);
        });
        // await this._election();
        // this._autoScaleInterval();
        this._active = true;
    }

    async _election() {
        const { childs, jobId } = this._jobData;
        const data = { options: this._options, pipeline: this._pipeline, jobData: this._jobData, jobId };
        await Promise.all(childs.map(c => this._elect({ ...data, nodeName: c })));
    }

    async _elect(options) {
        const { jobId, nodeName } = options;
        const key = `${jobId}/${nodeName}`;
        const lock = await stateAdapter.acquireLock(key);
        if (lock.success) {
            this._adapters.addMaster(options);
        }
        else {
            this._adapters.addSlave(options);
        }
    }

    finish() {
        this._active = false;
        clearInterval(this._interval);
        this._interval = null;
    }

    reportStats(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            // this._masterAdapters.report(d);
            // this._slaveAdapters.report(d);
        });
    }

    _autoScaleInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._activeInterval) {
                return;
            }
            try {
                this._activeInterval = true;
                Object.values(this._adapters).filter(a => a.isLeader).work();
            }
            catch (e) {
                log.throttle.error(e.message, { component });
            }
            finally {
                this._activeInterval = false;
            }
        }, this._options.interval);
    }

    _electionInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._activeInterval) {
                return;
            }
            try {
                this._activeInterval = true;
                this._election();
            }
            catch (e) {
                log.throttle.error(e.message, { component });
            }
            finally {
                this._activeInterval = false;
            }
        }, this._options.interval);
    }

    _checkPro() {
        Object.values(this._adapters).filter(a => a.isLeader).progress;
    }
}

module.exports = new AutoScaler();
