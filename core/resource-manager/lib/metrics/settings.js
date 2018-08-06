module.exports = {
    algorithms: {
        cpuUsage: {
            enable: true,
            mandatory: true,
            weight: 0.1
        },
        queue: {
            enable: true,
            mandatory: true,
            weight: 0.7
        },
        runTime: {
            enable: true,
            mandatory: true,
            weight: 0.1
        },
        templatesStore: {
            enable: true,
            mandatory: true,
            weight: 0.1
        }
    },
    pipelines: {
        queue: {
            enable: true,
            mandatory: true,
            weight: 1
        }
    }
};
