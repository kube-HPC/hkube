const uuidv4 = require('uuid/v4');

class VirtualLink {

    constructor(options) {
        this.source = options.source;
        this.target = options.target;
        this.edges = options.edges;
    }
}

module.exports = VirtualLink;