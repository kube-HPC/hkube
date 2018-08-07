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
                nodeSelector: {
                    core: 'true'
                },
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
                    }
                ],
                restartPolicy: 'Never'
            }
        },
        backoffLimit: 4
    }
};

module.exports = template;

