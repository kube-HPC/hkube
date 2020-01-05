const bson = require('bson');

const binaryDecode = (data) => {
    return bson.deserialize(data, { promoteBuffers: true, promoteValues: true });
};

const binaryEncode = bson.serialize;

module.exports = {
    binaryDecode,
    binaryEncode
};
