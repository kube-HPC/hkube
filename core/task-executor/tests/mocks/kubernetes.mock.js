const { StatusCodes } = require('http-status-codes');

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
                        { algorithmName: 'algo-car-lim-lower-req', message: 'Job.batch "algo-car-lim-lower-req-1thjj" is invalid: spec.template.spec.containers[2].resources.requests: Invalid value: "3": must be less than or equal to cpu limit', statusCode: StatusCodes.UNPROCESSABLE_ENTITY, spec: { spec: { template: { spec: { containers: [{ name: 'worker' }, { name: 'algorunner' }, { name: 'mycar' }]}}}} }
                    ];
                    const jobDetails = theArgs[0]?.jobDetails;
                    const failureEntry = supposeToFail.find(entry => entry.algorithmName === jobDetails?.algorithmName);

                    if (failureEntry) {
                        return {
                            jobDetails,
                            statusCode: failureEntry.statusCode,
                            message: failureEntry.message,
                            spec: failureEntry.spec
                        };
                    }
                
                    return {
                        statusCode: StatusCodes.CREATED,
                        jobDetails
                    };
                },
                getWorkerJobs: async () => { },
                getVersionsConfigMap: async () => { return {}; },
                getResourcesPerNode: async () => { return {}; },
                getSidecarConfigs: async () => { return {}; },
                getAllPVCNames: async () => { return ['pvc-1', 'pvc-2']; },
                getAllSecretNames: async () => { return ['secret-1', 'secret-2']; },
                getAllConfigMapNames: async () => { return ['config-map-1', 'config-map-2']; },
                getAllQueueNames: async () => { return ['test', 'default']; },
                getContainerDefaultResources: async () => { return { cpu: { defaultRequest: 0.1, defaultLimits: 0.2 }, memory: { defaultRequest: '128Mi', defaultLimits: '256Mi' } }; },
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
