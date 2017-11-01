
class Webhook {

    constructor(options) {
        this.timestamp = new Date();
        this.webhookID = options.webhookID;
        this.data = options.data;
    }
}

module.exports = Webhook