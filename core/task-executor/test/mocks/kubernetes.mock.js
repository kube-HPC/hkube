// module.exports = {
//     kubernetes: {
//         init: async () => { },
//         createJob: async () => {},
//         getWorkerJobs: async () => {},
//         getVersionsConfigMap: async () => {},
//     }
// };


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
                getWorkerJobs: async () => { },
                getVersionsConfigMap: async () => { },
                deleteJob: async (...theArgs) => {
                    registerCount('deleteJob', theArgs)
                }
            },
            callCount: (name) => { return callCount[name]; },
            clearCount: () => { callCount = {} },
        }
    }
};

