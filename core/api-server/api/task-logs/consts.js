const sources = {
    k8s: 'k8s',
    es: 'es'
};

const formats = {
    json: 'json',
    raw: 'raw'
};

const sortOrder = {
    asc: 'asc',
    desc: 'desc'
};

const containers = {
    pipelineDriver: 'driver',
    worker: 'worker',
    algorunner: 'algorunner'
};

const components = {
    Algorunner: 'Algorunner',
    Consumer: 'Jobs-Consumer',
};

const internalLogPrefix = 'wrapper::';
const sideCarPrefix = (sideCarContainerName) => `${sideCarContainerName}::`;

const LOGS_LIMIT = 500;

module.exports = {
    sources,
    formats,
    sortOrder,
    containers,
    components,
    internalLogPrefix,
    sideCarPrefix,
    LOGS_LIMIT,
};
