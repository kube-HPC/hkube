class StateManager {
    async init() {
        this.deleteInvoked = false
    }

    getAlgorithmRequests() {
        return null;
    }

    getKeys(path) {
        if (this.deleteInvoked) {
            return []
        }
        switch (path) {
            case "/webhooks":
                const webhooks = require('./webhooks.json');
                return webhooks.map(j => JSON.stringify(j));
            case "/jobs/status":
                const jobStatus = require('./jobStatus.json');
                return jobStatus.map(j => JSON.stringify(j));
            case "/jobs/results":
                const jobResults = require('./jobResults.json');
                return jobResults.map(j => JSON.stringify(j));
            default:
                return [];
        }
    }

    deleteKey() {
        this.deleteInvoked = true
    }
    reset() {
        this.deleteInvoked = false
    }
}

module.exports = new StateManager();
