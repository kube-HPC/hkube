const uuidv4 = require('uuid/v4');

class VirtualLink {

    constructor(options) {
        this.source = options.source;
        this.target = options.target;
        this.edges = Object.entries(options.edge).filter(([k, v]) => v).map(e => ({ type: e[0] }));
    }
}

module.exports = VirtualLink;