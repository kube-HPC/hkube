const NodejsWrapper = require('@hkube/nodejs-wrapper');
const algorithm = require('./index');

class Wrapper {
    constructor() {
        this._wrapper = null;
    }

    async init() {
        this._wrapper = NodejsWrapper.run(algorithm);
    }

    getWrapper() {
        return this._wrapper;
    }
}

module.exports = new Wrapper();
