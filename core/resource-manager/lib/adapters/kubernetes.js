
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').K8s;

class K8sAdapter extends Adapter {

    constructor(options) {
        super(options);
        this._stubData();
    }

    _stubData() {
        this._data = [{
            alg: 'green',
            cpu: 5
        },
        {
            alg: 'yellow',
            cpu: 2
        }]
    }

    getData() {
        log.info(`adapter started`, { component });
        return this._data;
    }
}

module.exports = K8sAdapter;