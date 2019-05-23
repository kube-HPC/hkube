const nodesStatus = require('../data/k8s-nodes.json');
const podsStatus = require('../data/k8s-pods.json');

const Client = class baseTest {
    constructor() { }
    get pods() {
        return { get: function () { return podsStatus } };
    }
    get nodes() {
        return { get: function () { return nodesStatus } };
    }
}

module.exports = {
    Client
}



