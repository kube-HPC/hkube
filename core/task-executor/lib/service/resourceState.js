/* const algoSchema = {
    algorithmName: '',
    exceededMaxJobs: true,
    missingResources: {
        cpu: true,
        gpu: true,
        memory: false
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
