const NodejsWrapper = require('@hkube/nodejs-wrapper');

class Wrapper {
    constructor() {
        this._wrapper = null;
    }

    async init() {
        this._wrapper = NodejsWrapper.run();
    }

    getWrapper() {
        return this._wrapper;
    }
}

module.exports = new Wrapper();
