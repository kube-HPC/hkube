const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const stateManager = require('../states/stateManager');
const { stateEvents } = require('../../common/consts/events');
const { workerStates } = require('../../common/consts/states');
const etcd = require('../states/discovery');
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._active = false;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._options = Object.assign({}, options);
        this._options.jobConsumer.setting.redis = options.redis;
        if (this._consumer) {
            this._consumer.removeAllListeners();
            this._consumer = null;
        }
        etcd.on('change',(res)=>{
            
        })



        this._consumer = new Consumer(this._options.jobConsumer);
        this._consumer.on('job', async (job) => {
            log.info(`Job arrived with inputs: ${JSON.stringify(job.data.input)}`);
            this._job = job;
            etcd.watch({ jobId: this._job.data.jobID })
            stateManager.setJob(job);
            stateManager.prepare(job);
            this.emit('job', job);
        });
        
        // this._unRegister();
        stateManager.once(stateEvents.stateEntered, ({ state }) => {
            this._consumer.register(this._options.jobConsumer)
        })
    }

    _register() {
        this._consumer.register(this._options.jobConsumer)
        // stateManager.once(stateEvents.stateEntered,({state})=>{
        //     this._unRegister();
        // })
    }

    _unRegister() {
        // this._consumer.unregister()
        stateManager.once(stateEvents.stateEntered, ({ state }) => {
            this._register();
        })
    }
    async finishJob(result) {
        if (!this._job)
            return;
        // TODO: handle error
        await etcd.unwatch({ jobId: this._job.data.jobID })
        await etcd.update({ jobId: this._job.data.jobID, taskId: this._job.id, status: 'completed', result: result });
        this._job.done(null,result);
        this._job = null;
    }
}

module.exports = new JobConsumer();