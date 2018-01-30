const uuidv4 = require('uuid/v4');

class VirtualNode {

    constructor() {
        this.id = uuidv4();
        this.links = [];
    }
}

module.exports = VirtualNode;