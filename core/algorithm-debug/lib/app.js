const NodejsWrapper = require('@hkube/nodejs-wrapper');
let wrapper;

const init = async () => {
    wrapper = NodejsWrapper.run();
};

const getWrapper = () => {
    return wrapper;
};

module.exports = { init, getWrapper };
