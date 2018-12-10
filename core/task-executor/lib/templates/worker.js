const jobTemplate = {
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
                nodeSelector: {
                    worker: 'true'
                },
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
                                name: 'JAEGER_AGENT_SERVICE_HOST',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'status.hostIP'
                                    }
                                }
                            }
                        ],
                        volumeMounts: [
                            {
                                name: 'varlog',
                                mountPath: '/var/log'
                            },
                            {
                                name: 'varlibdockercontainers',
                                mountPath: '/var/lib/docker/containers',
                                readOnly: true
                            }
                        ],
                        securityContext: {
                            privileged: true
                        }
                    },
                    {
                        name: 'algorunner',
                        image: 'hkube/algorunner:latest'
                    }
                ],
                volumes: [
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
                ],
                restartPolicy: 'Never'

            }
        },
        backoffLimit: 4
    }
};

module.exports = jobTemplate;
