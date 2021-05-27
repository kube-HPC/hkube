const { uid } = require('@hkube/uid');

const delay = d => new Promise(r => setTimeout(r, d));

const createJobId = () => uid();

module.exports = {
    delay,
    createJobId
};

