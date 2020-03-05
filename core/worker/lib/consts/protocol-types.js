const EncodingProtocols = {
    JSON: 'json',
    BSON: 'bson'
};

const StorageProtocols = {
    BY_RAW: 'byRaw',
    BY_REF: 'byRef'
};

const DefaultStorageProtocol = StorageProtocols.BY_RAW;
const DefaultEncodingProtocol = EncodingProtocols.JSON;

module.exports = { DefaultEncodingProtocol, DefaultStorageProtocol };
