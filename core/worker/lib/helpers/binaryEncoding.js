const bson = require('bson');

const binaryDecode = (data) => {
    const ret = bson.deserialize(data, { promoteBuffers: true, promoteValues: true });
    return ret;
};

const binaryEncode = (data) => {
    const size = bson.calculateObjectSize(data);
    return bson.serialize(data, { minInternalBufferSize: Math.floor(size * 1.1) });
};

module.exports = {
    binaryDecode,
    binaryEncode
};
