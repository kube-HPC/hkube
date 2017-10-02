const EventEmitter = require('events');
const { Consumer } = require('producer-consumer.rf');
const Logger = require('logger.rf');
const stateManager = require('../states/stateManager');
let log;

class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._options = Object.assign({},options);
        this._options.jobConsumer.setting.redis=options.redis
        if (this._consumer){
            this._consumer.removeAllListeners();
            this._consumer=null;
        }


        this._consumer = new Consumer(this._options.jobConsumer);
        this._consumer.on('job', async (job) => {
            log.info(`Job arrived with inputs: ${JSON.stringify(job.data.inputs)}`)
            stateManager.setJob(job);
            await stateManager.setWorkerState({transition:'prepare'})
            this.emit('job',job);
        })
        this._consumer.register(this._options.jobConsumer)
        
    }
}

module.exports = new JobConsumer();