
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const components = require('../consts/component-name');
class Persistence {
    constructor() {
        this.queue = null;
        this.queueName = null;
        this.etcdConfig = null;
        this.etcd = new Etcd();
    }  
    init({options}) {
        const {etcd, queueName, serviceName} = options;
        this.queueName = queueName;
        //    this.queue = queue;
        this.etcd.init({ etcd, serviceName });
    }

    async store(queue) {
        log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT});
        const status = await this.etcd.algorithmQueue.store({queueName: this.queueName, queue});
        if (status) {
            log.info('queue stored successfully', { component: components.ETCD_PERSISTENT});
        }
    }
    get() {
        return this.etcd.algorithmQueue.get({queueName: this.queueName});
    }
}


module.exports = new Persistence();
