const { ALGORITHM_QUEUE } = require('../consts/containers');

const algorithmQueueTemplate = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: ALGORITHM_QUEUE,
        labels: {
            type: ALGORITHM_QUEUE,
            app: ALGORITHM_QUEUE,
            group: 'hkube',
            core: 'true'
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
                    type: ALGORITHM_QUEUE,
                    app: ALGORITHM_QUEUE,
                    'metrics-group': ALGORITHM_QUEUE,
                    group: 'hkube'
                }
            },
            spec: {
                nodeSelector: {
                    core: 'true'
                },
                containers: [
                    {
                        name: ALGORITHM_QUEUE,
                        image: `hkube/${ALGORITHM_QUEUE}`,
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
                                name: 'INTERVAL',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'ALGORITHM_QUEUE_INTERVAL'
                                    }
                                }
                            },
                            {
                                name: 'PRODUCER_UPDATE_INTERVAL',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'ALGORITHM_QUEUE_PRODUCER_UPDATE_INTERVAL'
                                    }
                                }
                            },
                            {
                                name: 'MONGODB_SERVICE_USER_NAME',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'mongodb-secret',
                                        key: 'mongodb-username'
                                    }
                                }
                            },
                            {
                                name: 'MONGODB_SERVICE_PASSWORD',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'mongodb-secret',
                                        key: 'mongodb-password'
                                    }
                                }
                            },
                            {
                                name: 'MONGODB_DB_NAME',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'mongodb-secret',
                                        key: 'mongodb-database'
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
