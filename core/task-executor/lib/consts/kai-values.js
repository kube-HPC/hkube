module.exports = {
    ANNOTATIONS: {
        FRACTION: 'gpu-fraction',
        MEMORY: 'gpu-memory'
    },
    LABELS: {
        QUEUE: 'runai/queue'
    },
    SCHEDULER_NAME: 'kai-scheduler',
    KUBERNETES: {
        CRD_GROUP: 'apiextensions.k8s.io',
        CRD_VERSION: 'v1',
        CRD_RESOURCE: 'customresourcedefinitions',
        QUEUES_CRD_NAME: 'queues.scheduling.run.ai',
        QUEUES_API_GROUP: 'scheduling.run.ai',
        RESOURCE: 'queues'
    }
};
