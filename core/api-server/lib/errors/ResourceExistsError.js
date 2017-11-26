
class ResourceExistsError extends Error {
    constructor(resourceType, resourceName) {
        super(`${resourceType} ${resourceName} already exists`);
        this.status = 409;
    }
}

module.exports = ResourceExistsError;
