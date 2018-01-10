//const componentName = ['QUERIER', 'QUEUE', 'QUEUE_RUNNER', 'BOOTSTRAP'];

// module.exports = componentName.reduce((initial, component) => ({...initial, [component]: component}), {});

module.exports = {
    QUERIER: 'QUERIER', 
    QUEUE: 'QUEUE',
    QUEUE_RUNNER: 'QUEUE_RUNNER',
    BOOTSTRAP: 'BOOTSTRAP',
    HEURISTIC_RUNNER: 'HEURISTIC_RUNNER',
    MAIN: 'MAIN',
    ETCD_PERSISTENT: 'ETCD_PERSISTENT'
};
