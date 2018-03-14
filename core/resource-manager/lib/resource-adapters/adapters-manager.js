
class AdapterManager {

    constructor() {
        this.adapters = [];
    }

    async init(options) {
        options.adapters.forEach(a => {
            let Adapter = require(__dirname + '/' + a.name);
            this.adapters.push(new Adapter(a.connection));
        });
    }
}

module.exports = new AdapterManager();