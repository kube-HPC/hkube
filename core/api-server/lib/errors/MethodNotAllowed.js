class MethodNotAllowed extends Error {
    constructor() {
        super('Method Not Allowed');
        this.status = 405;
    }
}

module.exports = MethodNotAllowed;
