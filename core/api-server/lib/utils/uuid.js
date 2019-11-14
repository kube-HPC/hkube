const uuidV4 = require('uuid/v4');

const uuid = ({ length = 8 } = {}) => {
    return uuidV4({ length });
};

module.exports = uuid;
