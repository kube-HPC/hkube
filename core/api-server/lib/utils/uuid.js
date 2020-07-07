const { v4: uuidv4 } = require('uuid');
const cryptoRandomString = require('crypto-random-string');

const uuid = () => {
    return uuidv4();
};

const randomString = ({ length = 4 } = {}) => {
    return cryptoRandomString({ length, characters: '0123456789abcdefghijklmnopqrstuvwxyz' });
};

module.exports = {
    uuid,
    randomString
};
