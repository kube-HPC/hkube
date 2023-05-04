/* const algoSchema = {
    algorithmName: '',
    quantity: 0,
    missingResources: {
        cpu: 0,
        gpu: 0,
        memory: 0
    }
}; */

class ResourceLogState {    
    Init() {
        this.resourceLogState = [];
    }

    resetState() {
        this.resourceLogState = [];
    }

    addResourceLog(resourceLog) {
        this.resourceLogState.push(resourceLog);
    }

    async getResourceLogByName(algorithmName) {
        return this.resourceLogState.filter(resourceLog => resourceLog.algorithmName === algorithmName);
    }

    async getResourceLogs() {
        return this.resourceLogState;
    }
}

module.exports = {
    resourceLog: new ResourceLogState()
};
