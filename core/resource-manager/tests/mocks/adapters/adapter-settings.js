module.exports = {
    resources: {
        k8s: {
            enable: true,
            mandatory: true,
            cacheTTL: 1000 * 60 * 0.5
        }
    },
    algorithms: {
        prometheus: {
            enable: true,
            mandatory: false,
            cacheTTL: 1000 * 60 * 1
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
            cacheTTL: 1000 * 60 * 5
        }
    },
    drivers: {
        prometheus: {
            enable: true,
            mandatory: false,
            cacheTTL: 1000 * 60 * 1
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
