const EventEmitter = require('events');
const Etcd = require('etcd.rf');

class StateManager extends EventEmitter {

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
        this._watchJobResults();
    }

    async _watchJobResults() {
        await this._etcd.jobs.onJobResult((result) => {
            this.emit('job-result', result);
        });
    }
}

module.exports = new StateManager();