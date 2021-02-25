const template = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
        name: 'job-name',
        labels: {
            type: 'pipeline-driver',
            group: 'hkube',
            core: 'true',
            'metrics-group': 'pipeline-drivers'
        }
    },
    spec: {
        template: {
            metadata: {
                labels: {
                    group: 'hkube',
                    type: 'pipeline-driver',
                    'metrics-group': 'pipeline-drivers'
                }
            },
            spec: {
                containers: [
                    {
                        name: 'pipeline-driver',
                        image: 'hkube/pipeline-driver',
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            },
                            {
                                name: 'METRICS_PORT',
                                value: '3001'
                            },
                            {
                                name: 'INACTIVE_PAUSED_TIMEOUT_MS',
                                value: '60000'
                            },
                            {
                                name: 'POD_ID',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.uid'
                                    }
                                }
                            },
                            {
                                name: 'POD_NAME',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.name'
                                    }
                                }
                            },
                            {
                                name: 'DEFAULT_STORAGE',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'task-executor-configmap',
                                        key: 'DEFAULT_STORAGE'
                                    }
                                }
                            },
                            {
                                name: 'STORAGE_ENCODING',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'task-executor-configmap',
                                        key: 'STORAGE_ENCODING'
                                    }
                                }
                            },
                            {
                                name: 'STORAGE_RESULTS_THRESHOLD',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'pipeline-driver-configmap',
                                        key: 'STORAGE_RESULTS_THRESHOLD'
                                    }
                                }
                            },
                            {
                                name: 'CLUSTER_NAME',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'task-executor-configmap',
                                        key: 'CLUSTER_NAME'
                                    }
                                }
                            },
                        ],
                    }
                ],
                restartPolicy: 'Never'
            }
        },
        backoffLimit: 0
    }
};

module.exports = template;
