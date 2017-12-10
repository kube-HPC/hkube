class MethodNotAllowed extends Error {
    constructor(message) {
        super('Method Not Allowed');
        this.status = 405;
    }
}

module.exports = MethodNotAllowed;
