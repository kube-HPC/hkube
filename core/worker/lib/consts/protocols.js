const EncodingProtocols = {
    JSON: 'json',
    BSON: 'bson'
};

const DefaultEncodingProtocol = EncodingProtocols.JSON;

const StorageProtocols = {
    BY_RAW: 'byRaw',
    BY_REF: 'byRef'
};

const DefaultStorageProtocol = StorageProtocols.BY_RAW;

module.exports = { EncodingProtocols, StorageProtocols, DefaultEncodingProtocol, DefaultStorageProtocol };
