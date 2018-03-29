
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const components = require('../consts/component-name');
class Persistence {
    constructor() {
        this.etcdConfig = null;
        this.etcd = new Etcd();
    }  
    init({options}) {
        const {etcd, serviceName} = options;
        //    this.queue = queue;
        this.etcd.init({ etcd, serviceName });
        return this;
    }

    async store(tasks) {
        log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT});
        // TODO: should add to etcdHkube
        const status = await this.etcd.trigger.setState(tasks);
        if (status) {
            log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT});
        }
    }
    get() {
        return this.etcd.trigger.getState();
    }
}


module.exports = new Persistence();
