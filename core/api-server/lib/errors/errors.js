
const InvalidDataError = require('lib/errors/InvalidDataError');
const ResourceNotFoundError = require('lib/errors/ResourceNotFoundError');
const ResourceExistsError = require('lib/errors/ResourceExistsError');
const MethodNotAllowed = require('lib/errors/MethodNotAllowed');

module.exports = {
    InvalidDataError,
    ResourceNotFoundError,
    ResourceExistsError,
    MethodNotAllowed
};
