module.exports = {
    kubernetes: () => {
        let callCount = {};
        const registerCount = (name, args) => {
            if (!callCount[name]) {
                callCount[name] = [];
            }
            callCount[name].push(args);
        }
        return {
            mock: {
                init: async () => { },
                createJob: async (...theArgs) => {
                    registerCount('createJob', theArgs)
                },
                createDeployment: async () => { },
                updateDeployment: async () => { },
                deleteDeployment: async () => { },
                getWorkerJobs: async () => { },
                getPipelineDriversJobs: async () => { },
                getVersionsConfigMap: async () => { },
                deleteJob: async (...theArgs) => {
                    registerCount('deleteJob', theArgs)
                },
                kubeVersion: {
                    version: '1.18'
                }
            },
            callCount: (name) => { return callCount[name]; },
            clearCount: () => { callCount = {} },
        }
    }
};

