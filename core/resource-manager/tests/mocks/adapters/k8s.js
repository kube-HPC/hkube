

const Adapter = require('./Adapter');
const k8s = require('../data/k8s.json');

class K8sAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
    }

    async getData() {
        return new Map(k8s);
    }
}

module.exports = K8sAdapter;