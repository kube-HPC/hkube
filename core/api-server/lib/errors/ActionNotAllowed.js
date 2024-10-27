const HttpStatus = require('http-status-codes');

class ActionNotAllowed extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.status = HttpStatus.StatusCodes.BAD_REQUEST;
    }
}

module.exports = ActionNotAllowed;
