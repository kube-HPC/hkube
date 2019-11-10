const EventEmitter = require('events');

const spawn = (command, args) => {
    return new child();
}

class child extends EventEmitter {
    constructor() {
        super();
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
        setTimeout(() => this.emit('close'), 2000);
    }
}

module.exports = {
    spawn
}
