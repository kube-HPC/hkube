
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
                name: 'kubernetesMock',
                init: async () => { },
                createJob: async (...theArgs) => {
                    registerCount('createJob', theArgs);
                },
                getWorkerJobs: async () => { },
                getVersionsConfigMap: async () => { return {} },
                getResourcesPerNode: async () => { return {} },
                getSidecarConfigs: async () => { return {} }
            },
            callCount: (name) => { return callCount[name]; },
            clearCount: () => {
                callCount = {}
            },
        }
    }
};

