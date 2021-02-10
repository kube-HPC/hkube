const { ALGORITHM_DEBUG } = require('../consts/containers');

const deploymentDebugTemplate = (algorithmName = '') => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: `worker-${algorithmName}`,
        labels: {
            app: `worker-${algorithmName}`,
            group: 'hkube',
            core: 'true',
            'metrics-group': ALGORITHM_DEBUG,
            type: ALGORITHM_DEBUG
        }
    },
    spec: {
        replicas: 1,
        selector: {
            matchLabels: {
                app: `worker-${algorithmName}`
            }
        },
        template: {
            metadata: {
                labels: {
                    app: `worker-${algorithmName}`,
                    group: 'hkube',
                    'metrics-group': ALGORITHM_DEBUG,
                    type: ALGORITHM_DEBUG
                }
            },
            spec: {
                serviceAccountName: 'worker-serviceaccount',
                containers: [
                    {
                        name: ALGORITHM_DEBUG,
                        image: 'hkube/worker',
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            },
                            {
                                name: 'ALGORITHM_TYPE',
                                value: `${algorithmName}`
                            },
                            {
                                name: 'METRICS_PORT',
                                value: '3001'
                            },
                            {
                                name: 'INACTIVE_PAUSED_WORKER_TIMEOUT_MS',
                                value: '2147483647'
                            },
                            {
                                name: 'INACTIVE_WORKER_TIMEOUT_MS',
                                value: '2147483647'
                            },
                            {
                                name: 'ALGORITHM_DISCONNECTED_TIMEOUT_MS',
                                value: '2147483647'
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
                                        name: 'algorithm-operator-configmap',
                                        key: 'DEFAULT_STORAGE'
                                    }
                                }
                            },
                            {
                                name: 'STORAGE_ENCODING',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'STORAGE_ENCODING'
                                    }
                                }
                            },
                            {
                                name: 'DISCOVERY_ENCODING',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'DISCOVERY_ENCODING'
                                    }
                                }
                            },
                            {
                                name: 'CLUSTER_NAME',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'CLUSTER_NAME'
                                    }
                                }
                            },
                            {
                                name: 'DEBUG_MODE',
                                value: 'true'
                            },
                            {
                                name: 'DISABLE_ALGORITHM_LOGGING',
                                value: 'true'
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
                            },
                            {
                                name: 'BASE_DATASOURCES_DIRECTORY',
                                value: '/hkube/datasources-storage'
                            },
                        ],
                        port: {
                            containerPort: 3000
                        }
                    }
                ]

            }
        }
    }
});

const workerService = (algorithmName = '') => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `worker-service-${algorithmName}`,
        annotations: {
            'prometheus.io/scrape': 'true'
        },
        labels: {
            app: `worker-${algorithmName}`,
            group: 'hkube',
            core: 'true',
            type: ALGORITHM_DEBUG
        }
    },
    spec: {
        selector: {
            'metrics-group': ALGORITHM_DEBUG,
            group: 'hkube',
            app: `worker-${algorithmName}`,
        },
        ports: [
            {
                name: 'metrics',
                port: 80,
                targetPort: 3000
            }
        ]
    }
});

const workerIngress = (algorithmName = '', { ingressHost, ingressPrefix = '', ingressUseRegex = false } = {}) => ({
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata: {
        name: `ingress-worker-${algorithmName}`,
        annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000'
        },
        labels: {
            app: `ingress-${ALGORITHM_DEBUG}`,
            core: 'true',
            type: ALGORITHM_DEBUG
        }
    },
    spec: {
        rules: [
            {
                http: {
                    paths: [{
                        path: ingressUseRegex ? `${ingressPrefix}/hkube/debug/${algorithmName}(/|$)(.*)` : `${ingressPrefix}/hkube/debug/${algorithmName}`,
                        backend: {
                            serviceName: `worker-service-${algorithmName}`,
                            servicePort: 80
                        }
                    }]

                },
                host: ingressHost || undefined
            }
        ]
    }
});

module.exports = {
    deploymentDebugTemplate,
    workerIngress,
    workerService
};
