const EventEmitter = require('events');
const validate = require('djsv');
const { Consumer } = require('producer-consumer.rf');
const schema = require('./schema');
const stateManager = require('lib/state/state-manager');
const Logger = require('logger.rf');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

class JobConsumer extends EventEmitter {

    constructor() {
        super();
    }

    /**
     * Init the consumer and register for jobs
     * @param {*} options 
     */
    init(options) {
        const setting = {};
        const res = validate(schema, setting);
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }
        this._consumer = new Consumer(setting);
        this._consumer.register(setting);
        this._consumer.on('job', (job) => {
            job.id = 'pipeline-id:aea80705-fe25-4ef2-b631-70ec037c2161';
            stateManager.watch(`/jobs/${job.id}/state`, (res) => {
                if (res.action === 'set' && res.node.value) {
                    const r = JSON.parse(res.node.value);
                    if (r.status === 'stopped') {
                        this.emit('job-stop', job);
                    }
                }
            });
            this.emit('job-start', job);
        })
    }
}

module.exports = new JobConsumer();