const { InvalidDataError } = require('../errors');

const arrayStartRegex = /^\[/;
const arrayEndRegex = /\]$/;

/**
 * Takes a stringified payload and converts it to an array
 *
 * @template T
 * @type {(payload: any) => T[]}
 */
module.exports = (payload, fieldName) => {
    let collection = [];
    let _payload = payload;
    if (Array.isArray(payload)) return payload;
    if (!arrayStartRegex.test(payload)) {
        _payload = `[${_payload}`;
    }
    if (!arrayEndRegex.test(payload)) {
        _payload = `${_payload}]`;
    }
    try {
        collection = [].concat(JSON.parse(_payload));
    } catch (e) {
        throw new InvalidDataError(`invalid ${fieldName} provided`);
    }
    return collection;
};
