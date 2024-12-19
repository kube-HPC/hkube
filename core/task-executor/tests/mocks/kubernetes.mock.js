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
                getVersionsConfigMap: async () => { return {}; },
                getResourcesPerNode: async () => { return {}; },
                getSidecarConfigs: async () => { return {}; },
                getAllPVCNames: async () => { return ['pvc-1', 'pvc-2']; },
                getAllSecretNames: async () => { return ['secret-1', 'secret-2']; },
                getAllConfigMapNames: async () => { return ['config-map-1', 'config-map-2']; }
            },
            callCount: (name) => {
                return callCount[name];
            },
            clearCount: () => {
                callCount = {};
            },
        };
    }
};
