// const componentName = ['QUERIER', 'QUEUE', 'QUEUE_RUNNER', 'BOOTSTRAP'];

// module.exports = componentName.reduce((initial, component) => ({...initial, [component]: component}), {});

module.exports = {
    MAIN: 'MAIN',
    TRIGGER_QUEUE: 'TRIGGER_QUEUE',
    CRON: 'CRON',
    STORED_PIPELINES_LISTENER: 'STORED_PIPELINES_LISTENER',
    TRIGGER_RUNNER: 'TRIGGER_RUNNER',
    PIPELINE_PRODUCER: 'PIPELINE_PRODUCER',
    PIPELINE_TRIGGER: 'PIPELINE_TRIGGER'

};
