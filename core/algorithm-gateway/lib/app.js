const NodejsWrapper = require('@hkube/nodejs-wrapper');

const init = async () => {
    this._algorunner = NodejsWrapper.run();
};



module.exports = { init };
