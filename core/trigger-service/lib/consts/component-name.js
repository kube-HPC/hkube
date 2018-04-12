// const componentName = ['QUERIER', 'QUEUE', 'QUEUE_RUNNER', 'BOOTSTRAP'];

// module.exports = componentName.reduce((initial, component) => ({...initial, [component]: component}), {});

module.exports = {
    MAIN: 'MAIN',
    TRIGGER:'TRIGGER',
    CRON:'CRON',
    STORED_PIPELINES_LISTENER:'STORED_PIPELINES_LISTENER'

};
