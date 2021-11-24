module.exports = {
    kubernetes: () => {
        let callCount = {};
        let listData = [];

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
                createDeployment: async (...theArgs) => { registerCount('createDeployment', theArgs) },
                updateDeployment: async () => { },
                getDeployments: async () => ({ body: { items: listData } }),
                deleteDeployment: async () => { },
                getWorkerJobs: async () => { },
                getPipelineDriversJobs: async () => { },
                getVersionsConfigMap: async () => { },
                deleteJob: async (...theArgs) => {
                    registerCount('deleteJob', theArgs)
                },
                deployExposedPod: async (...theArgs) => {
                    registerCount('deployExposedPod', theArgs)
                },
                kubeVersion: {
                    version: '1.18'
                }
            },
            setList: (list) => {
                listData = list;
            },
            callCount: (name) => { return callCount[name] || []; },
            clearCount: () => { callCount = {} },
        }
    }
};

