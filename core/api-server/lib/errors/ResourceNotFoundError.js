const HttpStatus = require('http-status-codes');

class ResourceNotFoundError extends Error {
    constructor(resourceType, resourceName, error) {
        super(`${resourceType} ${resourceName} Not Found`);
        this.status = HttpStatus.StatusCodes.NOT_FOUND;
        this.details = error;
    }
}

module.exports = ResourceNotFoundError;
