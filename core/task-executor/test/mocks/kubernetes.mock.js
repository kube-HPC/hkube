module.exports = {
    kubernetes: {
        init: async () => { console.log('kubernetes init mock') },
        createJob: async () => {},
        getWorkerJobs: async () => {},
        getVersionsConfigMap: async () => {},
    }
};
