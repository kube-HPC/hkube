const InvalidDataError = require('./InvalidDataError');
const ResourceNotFoundError = require('./ResourceNotFoundError');
const ResourceExistsError = require('./ResourceExistsError');
const MethodNotAllowed = require('./MethodNotAllowed');
const ActionNotAllowed = require('./ActionNotAllowed');
const AuthenticationError = require('./AuthenticationError');

module.exports = {
    InvalidDataError,
    ResourceNotFoundError,
    ResourceExistsError,
    MethodNotAllowed,
    ActionNotAllowed,
    AuthenticationError
};
