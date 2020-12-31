const { isDBError, errorTypes } = require('@hkube/db/lib/errors');
const {
    ResourceNotFoundError,
    InvalidDataError,
} = require('./../../../lib/errors');

module.exports = (error, req, res, next) => {
    if (isDBError(error)) {
        if (error.type === errorTypes.NOT_FOUND) {
            throw new ResourceNotFoundError('dataSource', error.metaData.id);
        }
        throw new InvalidDataError(error.message);
    }
    return next(error);
};
