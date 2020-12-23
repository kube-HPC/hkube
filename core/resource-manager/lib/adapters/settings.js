module.exports = {
    resources: {
        k8s: {
            enable: false,
            mandatory: true,
            cacheTTL: 30
        }
    },
    algorithms: {
        prometheus: {
            enable: false,
            mandatory: false,
            cacheTTL: 60
        },
        queue: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        },
        templatesStore: {
            enable: true,
            mandatory: true,
            cacheTTL: 10
        }
    },
    drivers: {
        prometheus: {
            enable: false,
            mandatory: false,
            cacheTTL: 60
        },
        queue: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        },
        templatesStore: {
            enable: true,
            mandatory: true,
            cacheTTL: 300
        }
    }
};
