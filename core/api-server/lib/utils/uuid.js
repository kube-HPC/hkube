
const randString = require('crypto-random-string');

const uuid = ({ length = 8 } = {}) => {
    return randString({ length });
};

module.exports = uuid;
