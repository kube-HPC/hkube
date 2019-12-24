const algoMetricsDir = '/var/metrics';
const workerTemplate = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
        name: 'job-name',
        labels: {
            type: 'worker',
            group: 'hkube',
            core: 'true',
            'algorithm-name': 'algorithm-name',
            'metrics-group': 'workers'
        }
    },
    spec: {
        template: {
            metadata: {
                labels: {
                    group: 'hkube',
                    type: 'worker',
                    'algorithm-name': 'algorithm-name',
                    'metrics-group': 'workers'
                }
            },
            spec: {
                serviceAccountName: 'worker-serviceaccount',
                containers: [
                    {
                        name: 'worker',
                        image: 'hkube/worker:latest',
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            },
                            {
                                name: 'ALGORITHM_TYPE',
                                value: 'algorithm-name'
                            },
                            {
                                name: 'METRICS_PORT',
                                value: '3001'
                            },
                            {
                                name: 'INACTIVE_PAUSED_WORKER_TIMEOUT_MS',
                                value: '10000'
                            },
                            {
                                name: 'ALGO_METRICS_DIR',
                                value: `${algoMetricsDir}`
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
                                name: 'NAMESPACE',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.namespace'
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
                                name: 'CLUSTER_NAME',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'task-executor-configmap',
                                        key: 'CLUSTER_NAME'
                                    }
                                }
                            },
                            {
                                name: 'JAEGER_AGENT_SERVICE_HOST',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'status.hostIP'
                                    }
                                }
                            },
                            {
                                name: 'WORKER_SOCKET_MAX_PAYLOAD_BYTES',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'task-executor-configmap',
                                        key: 'WORKER_SOCKET_MAX_PAYLOAD_BYTES'
                                    }
                                }
                            },
                        ],
                    },
                    {
                        name: 'algorunner',
                        image: 'hkube/algorunner:latest',
                        env: [
                            {
                                name: 'ALGO_METRICS_DIR',
                                value: `${algoMetricsDir}`
                            }
                        ]
                    }
                ],
                restartPolicy: 'Never'
            }
        },
        backoffLimit: 4
    }
};

const logVolumes = [
    {
        name: 'varlog',
        hostPath: {
            path: '/var/log'
        }
    },
    {
        name: 'varlibdockercontainers',
        hostPath: {
            path: '/var/lib/docker/containers'
        }
    }
];

const algoMetricVolume = {
    name: 'algometrics',
    emptyDir: {}
};


const sharedVolumeMounts = [
    {
        name: 'algometrics',
        mountPath: `${algoMetricsDir}`
    }
];

const logVolumeMounts = [
    {
        name: 'varlog',
        mountPath: '/var/log'
    },
    {
        name: 'varlibdockercontainers',
        mountPath: '/var/lib/docker/containers',
        readOnly: true
    }
];

module.exports = {
    workerTemplate,
    logVolumes,
    logVolumeMounts,
    sharedVolumeMounts,
    algoMetricVolume
};
