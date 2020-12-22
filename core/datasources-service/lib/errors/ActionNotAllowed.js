const HttpStatus = require('http-status-codes');

class ActionNotAllowed extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.status = HttpStatus.BAD_REQUEST;
    }
}

module.exports = ActionNotAllowed;
