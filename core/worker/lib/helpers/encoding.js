const { Encoding } = require('@hkube/encoding');

class EncodingHelper {
    setEncoding(type) {
        this._encoding = new Encoding({ type });
    }

    decode(...args) {
        return this._encoding.decode(...args);
    }

    encode(...args) {
        return this._encoding.encode(...args);
    }
}

module.exports = new EncodingHelper();
