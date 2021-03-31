const { InvalidDataError } = require('../errors');

class Snapshots {
    constructor(validator) {
        this._validator = validator;
    }

    dataSourceExists({ name, id, snapshot }) {
        this._validator.validate(this._validator.definitions.dataSourceExists, {
            name,
            id,
            snapshot,
        });
        if (id && snapshot.name) {
            throw new InvalidDataError(
                'must provide *only* one of (id | snapshot.name)'
            );
        }
        if (id && name) {
            throw new InvalidDataError('must not provide both "name" and "id"');
        }
        if (snapshot.name && !name) {
            throw new InvalidDataError(
                'must provide "name" when validating by "snapshot.name"'
            );
        }
    }
}

module.exports = Snapshots;
