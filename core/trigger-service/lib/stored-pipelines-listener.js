
const events = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const {componentName} = require('./consts/index');
const {prefix} = require('./consts/stroed-pipeline-events'); 
class StoredPipelinesListener extends events {
    constructor() {
        super();
        this.etcdConfig = null;
        this.etcd = new Etcd();
    }  
    async init(options) {
        const {etcd, serviceName} = options;
        //    this.queue = queue;
        this.etcd.init({ etcd, serviceName });
        this._getAndWatch();
        return this;
    }

    // async store(tasks) {
    //     log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT});
    //     // TODO: should add to etcdHkube
    //     trigger.addTrigger(tasks);
    //     const status = await this.etcd.trigger.setState(tasks);
    //     if (status) {
    //         log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT});
    //     }
    //  }
    
    async _getAndWatch() {
        this.etcd.pipelines.on('change', pipeline => this._filterForSpecificTrigger([pipeline], prefix.CHANGE));
        this.etcd.pipelines.on('delete', pipeline => this._filterForSpecificTrigger([pipeline], prefix.DELETE));
        await this.etcd.pipelines.watch();
        const pipelines = await this.etcd.pipelines.list();
        this._filterForSpecificTrigger(pipelines, prefix.INIT);
    }
    async getTriggeredPipelineByType(type) {
        try {
            const pipelines = await this.etcd.pipelines.list();
            return this._filterForSpecificTrigger(pipelines)[type];
        }
        catch (error) {
            log.error(`didn't received data from etcd  error:${error} `, { component: componentName.STORED_PIPELINES_LISTENER});
        }
    }
    _filterForSpecificTrigger(pipelines, eventPrefix = null) {
        const pipelinesByTriggerType = {};
        pipelines.filter(p => p.triggers != null).forEach(p => {
            Object.keys(p.triggers).forEach(t => {
                if (!pipelinesByTriggerType[t]) {
                    pipelinesByTriggerType[t] = [];
                }
                pipelinesByTriggerType[t].push(p);
            });
        });
        if (eventPrefix) {
            Object.keys(pipelinesByTriggerType)
                .forEach(t => pipelinesByTriggerType[t].forEach(task => this.emit(`${eventPrefix}-${t}`, task)));
        }

        return pipelinesByTriggerType;
    }
}


module.exports = new StoredPipelinesListener();
