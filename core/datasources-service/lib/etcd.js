const Etcd = require('@hkube/etcd');

class StateManager {
    constructor(option) {
        const options = option || {};
        this._etcd = new Etcd({
            ...options.etcd,
            serviceName: options.serviceName,
        });
    }
}

module.exports = StateManager;
