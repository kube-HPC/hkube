const InvalidDataError = require('./InvalidDataError');
const ResourceNotFoundError = require('./ResourceNotFoundError');
const ResourceExistsError = require('./ResourceExistsError');
const MethodNotAllowed = require('./MethodNotAllowed');
const ActionNotAllowed = require('./ActionNotAllowed');
const NotModified = require('./NotModified');

module.exports = {
    InvalidDataError,
    ResourceNotFoundError,
    ResourceExistsError,
    MethodNotAllowed,
    ActionNotAllowed,
    NotModified,
};
