const HttpStatus = require('http-status-codes');

class NotModified extends Error {
    constructor(message) {
        super(message);
        this.status = HttpStatus.NOT_MODIFIED;
    }
}

module.exports = NotModified;
