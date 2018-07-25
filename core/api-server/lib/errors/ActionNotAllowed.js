class ActionNotAllowed extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.status = 400;
    }
}

module.exports = ActionNotAllowed;
