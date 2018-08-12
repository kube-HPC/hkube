module.exports = {
    resources: {
        k8s: {
            enable: true,
            mandatory: true,
            cacheTTL: 30
        }
    },
    algorithms: {
        prometheus: {
            enable: true,
            mandatory: false,
            cacheTTL: 60
        },
        queue: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        },
        store: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        },
        templatesStore: {
            enable: true,
            mandatory: true,
            cacheTTL: 300
        }
    },
    drivers: {
        prometheus: {
            enable: true,
            mandatory: false,
            cacheTTL: 60
        },
        queue: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        },
        store: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        },
        templatesStore: {
            enable: true,
            mandatory: true,
            cacheTTL: 0
        }
    }
};
