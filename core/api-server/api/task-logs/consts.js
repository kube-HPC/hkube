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

const LOGS_LIMIT = 500;

const podStatus = {
    NORMAL: 'NORMAL',
    NO_IMAGE: 'NO_IMAGE',
    ERROR: 'ERROR',
    NOT_EXIST: 'NOT_EXIST',

};

module.exports = {
    sources,
    formats,
    sortOrder,
    containers,
    components,
    internalLogPrefix,
    LOGS_LIMIT,
    podStatus
};
