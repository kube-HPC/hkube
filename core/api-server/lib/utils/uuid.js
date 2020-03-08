const uuidV4 = require('uuid/v4');
const cryptoRandomString = require('crypto-random-string');

const uuid = () => {
    return uuidV4();
};

const randomString = ({ length = 4 } = {}) => {
    return cryptoRandomString({ length, characters: '0123456789abcdefghijklmnopqrstuvwxyz' });
};

module.exports = {
    uuid,
    randomString
};
