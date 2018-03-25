const nodesStatus = require('../data/k8s-nodes.json');
const podsStatus = require('../data/k8s-pods.json');

const b = class baseTest {
    constructor() { }
    get pods() {
        return { get: function () { return podsStatus } };
    }
    get nodes() {
        return { get: function () { return nodesStatus } };
    }
}

class test extends b {
    constructor() { }



}

const Core = b;
const config = { fromKubeconfig: function () { return } };

module.exports = {
    Core,
    config
}



