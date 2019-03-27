const { ALGORITHM_QUEUE } = require('../consts/containers');

const algorithmQueueTemplate = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: ALGORITHM_QUEUE,
        labels: {
            app: ALGORITHM_QUEUE,
            group: 'hkube',
            core: 'true',
            'metrics-group': ALGORITHM_QUEUE
        }
    },
    spec: {
        replicas: 1,
        selector: {
            matchLabels: {
                app: ALGORITHM_QUEUE
            }
        },
        template: {
            metadata: {
                labels: {
                    app: ALGORITHM_QUEUE,
                    group: 'hkube',
                    'metrics-group': ALGORITHM_QUEUE
                }
            },
            spec: {
                nodeSelector: {
                    core: 'true'
                },
                containers: [
                    {
                        name: ALGORITHM_QUEUE,
                        image: `hkube/${ALGORITHM_QUEUE}:latest`,
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
