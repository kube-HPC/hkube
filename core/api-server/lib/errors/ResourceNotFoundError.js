
class ResourceNotFoundError extends Error {
    constructor(resourceType, resourceName) {
        super(`${resourceType} ${resourceName} Not Found`);
        this.status = 404;
    }
}

module.exports = ResourceNotFoundError;
