const algorithmQueueTemplate = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: 'algorithm-queue-algorithm-name',
        labels: {
            app: 'algorithm-queue-algorithm-name',
            group: 'hkube',
            core: 'true',
            'metrics-group': 'algorithm-queue'
        }
    },
    spec: {
        replicas: 1,
        selector: {
            matchLabels: {
                app: 'algorithm-queue-algorithm-name'
            }
        },
        template: {
            metadata: {
                labels: {
                    app: 'algorithm-queue-algorithm-name',
                    group: 'hkube',
                    'metrics-group': 'algorithm-queue'
                }
            },
            spec: {
                nodeSelector: {
                    core: 'true'
                },
                containers: [
                    {
                        name: 'algorithm-queue',
                        image: 'hkube/algorithm-queue:latest',
                        ports: [
                            {
                                containerPort: 3000
                            }
                        ],
                        env: [
                            {
                                name: 'ALGORITHM_TYPE',
                                value: 'algorithm-name'
                            },
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            },
                            {
                                name: 'METRICS_PORT',
                                value: '3000'
                            },
                            {
                                name: 'JAEGER_AGENT_SERVICE_HOST',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'status.hostIP'
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        }
    }
};

module.exports = {
    algorithmQueueTemplate
};
