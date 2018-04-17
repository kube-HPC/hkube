const jobTemplate = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
        name: 'job-name',
        labels: {
            type: 'worker',
            group: 'hkube',
            'algorithm-name': 'algorithm-name',
            'metrics-group': 'workers'
        }
    },
    spec: {
        template: {
            spec: {
                nodeSelector: {
                    worker: 'true'
                },
                containers: [
                    {
                        name: 'worker',
                        image: 'hkube/worker:latest',
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'kube'
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
                                name: 'AWS_ACCESS_KEY_ID',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 's3-secret',
                                        key: 'awsKey'
                                    }
                                }
                            },
                            {
                                name: 'AWS_SECRET_ACCESS_KEY',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 's3-secret',
                                        key: 'awsSecret'
                                    }
                                }
                            },
                            {
                                name: 'S3_ENDPOINT_URL',
                                // value: 'http://10.32.10.24:9000'
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 's3-secret',
                                        key: 'awsEndpointUrl'
                                    }
                                }
                            },
                            {
                                name: 'DEFAULT_STORAGE',
                                value: 's3'
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

module.exports = {
    jobTemplate
};
