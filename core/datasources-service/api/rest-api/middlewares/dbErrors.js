const { isDBError, errorTypes } = require('@hkube/db/lib/errors');
const {
    ResourceNotFoundError,
    InvalidDataError,
    ResourceExistsError,
} = require('./../../../lib/errors');

module.exports = (error, req, res, next) => {
    if (isDBError(error)) {
        switch (error.type) {
            case errorTypes.NOT_FOUND:
                throw new ResourceNotFoundError(
                    error.metaData.entityType,
                    error.metaData.id
                );
            case errorTypes.CONFLICT:
                throw new ResourceExistsError(
                    error.metaData.entityType,
                    error.metaData.fieldName
                );

            default:
                throw new InvalidDataError(error.message);
        }
    }
    return next(error);
};
