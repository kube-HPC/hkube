const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const { NodesMap } = require('@hkube/dag');
const stateAdapter = require('../../states/stateAdapter');
const Progress = require('../core/progress');
const Interval = require('../core/interval');
const Adapters = require('../adapters/adapters');
const { Components, streamingEvents } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

class AutoScaler extends EventEmitter {
    init(options) {
        this._options = options.streaming;
        log = Logger.GetLogFromContainer();
    }

    async start(jobData) {
        this._jobData = jobData;
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._dag = new NodesMap(this._pipeline);
        this._nodes = this._pipeline.nodes.reduce((acc, cur) => {
            acc[cur.nodeName] = cur;
            return acc;
        }, {});
        this._adapters = new Adapters();
        this._progress = new Progress();
        this._progress.on(streamingEvents.PROGRESS_CHANGED, (changes) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changes);
        });

        await this._election();

        this._statsInterval = new Interval({ delay: this._options.autoScaler.interval })
            .onFunc(() => this._doWork())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();

        this._electInterval = new Interval({ delay: this._options.election.interval })
            .onFunc(() => this._election())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();

        this._active = true;
    }

    async _election() {
        const { childs, jobId } = this._jobData;
        const data = { config: this._options.autoScaler, pipeline: this._pipeline, jobData: this._jobData, jobId };
        await Promise.all(childs.map(c => this._elect({ ...data, nodeName: c, node: this._getNode(c) })));
    }

    async _elect(options) {
        const { jobId, nodeName } = options;
        const key = `${jobId}/${nodeName}`;
        const lock = await stateAdapter.acquireLock(key);
        this._adapters.addAdapter({ isMaster: lock.success, options });
    }

    _getNode(nodeName) {
        const node = this._nodes[nodeName];
        const parents = this._dag._parents(nodeName);
        const childs = this._dag._childs(nodeName);
        return { ...node, parents, childs };
    }

    finish() {
        this._active = false;
        this._statsInterval.stop();
        this._electInterval.stop();
        this._adapters.finish();
    }

    reportStats(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            this._adapters.report({ jobId: this._jobData.jobId, ...d });
        });
    }

    _doWork() {
        this.autoScale();
        this.checkProgress();
    }

    autoScale() {
        this._adapters.scale();
    }

    checkProgress() {
        const progress = this._adapters.progress();
        progress.forEach(p => {
            this._progress.update(p.nodeName, p.progress);
        });
        return this._progress.check();
    }
}

module.exports = new AutoScaler();
