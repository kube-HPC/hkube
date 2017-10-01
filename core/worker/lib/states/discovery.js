const etcd_rf = require('etcd.rf');
const Logger = require('logger.rf');
const uuidv4 = require('uuid/v4');

let log;
class EtcdDiscovery {
    constructor() {
        this._etcdDiscovery=null;
        this._id=uuidv4();
    }

    async init(options){
        log=Logger.GetLogFromContainer();
        this._etcdDiscovery = new etcd_rf();
        await this._etcdDiscovery.init(options.etcdDiscovery.init);
        await this._etcdDiscovery.register(options.etcdDiscovery.register);
    }

    async setState(options){
        const {data}=options;
        await this._etcdDiscovery.set({
            data,
            instanceId:this.id,
            postfix:'state'
        });
    }
}

module.exports=new EtcdDiscovery();