const etcd_rf = require('etcd.rf');
const Logger = require('logger.rf');
const uuidv4 = require('uuid/v4');

let log;
class EtcdDiscovery {
    constructor() {
        this._etcd=null;
    }

    async init(options){
        log=Logger.GetLogFromContainer();
        this._etcd = new etcd_rf();
        await this._etcd.init(options.etcdDiscovery.init);
        await this._etcd.discovery.register(options.etcdDiscovery.register);
    }

    async setState(options){
        const {data}=options;
        await this._etcd.services.set({
            data,
            postfix:'state'
        });
    }

    updateInit({ jobId, taskId }) {
        this._etcd.updateInitSetting({ jobId, taskId });
    }

    async update(options) {
        await Promise.all([
            this._etcd.jobs.setTaskStatus(options.status),
            this._etcd.jobs.setTaskResult(options.result)
        ]);
    }


}

module.exports=new EtcdDiscovery();