const { binaryDecode, binaryEncode } = require('../helpers/binaryEncoding');

class Encoding {
    constructor() {
        this._encodingTypes = {
            json: {
                decode: JSON.parse,
                encode: JSON.stringify
            },
            bson: {
                decode: binaryDecode,
                encode: binaryEncode
            }
        };
    }

    setEncoding(type) {
        this._encoding = this._encodingTypes[type];
    }

    decode(...args) {
        return this._encoding.decode(...args);
    }

    encode(...args) {
        return this._encoding.encode(...args);
    }
}


module.exports = new Encoding();
