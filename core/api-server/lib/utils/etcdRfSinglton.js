//this module is just to make the etcd client a singleton
const etcdRf = require('etcd.rf');

class etcdRfSinglton {

    init(maincfg) {
        this.etcdDiscovery = new etcdRf();
        //this.etcdDiscovery.init({ host: '127.0.0.1', port: 4001 })
        this.etcdDiscovery.init({etcd:maincfg.etcd, serviceName:maincfg
            .serviceName})
    }

    get client() {
        return this.etcdDiscovery;
    }
}


module.exports = new etcdRfSinglton()




