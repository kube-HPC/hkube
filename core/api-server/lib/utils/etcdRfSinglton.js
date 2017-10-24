//this module is just to make the etcd client a singleton
const etcdRf = require('etcd.rf');

class etcdRfSinglton {



    init(maincfg) {
        this.etcdDiscovery = new etcdRf(maincfg.etcd);
        this.etcdDiscovery.init({ host: '127.0.0.1', port: 4001 })
    }

    get client() {
        return this.etcdDiscovery;
    }
}


module.exports = new etcdRfSinglton()




