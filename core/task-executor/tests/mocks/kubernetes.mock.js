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
                    const supposeToFail = [
                        { algorithmName: 'algo-car-lim-lower-req', error: 'Job is invalid: mycar.resources.requests: Invalid value: 2: must be less than or equal to cpu limit', statusCode: 422 }
                    ];
                    const jobDetails = theArgs[0]?.jobDetails;
                    const failureEntry = supposeToFail.find(entry => entry.algorithmName === jobDetails?.algorithmName);

                    if (failureEntry) {
                        return {
                            job: jobDetails,
                            statusCode: failureEntry.statusCode,
                            error: failureEntry.error
                        };
                    }
                
                    return {
                        statusCode: 200,
                        job: jobDetails
                    };
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
