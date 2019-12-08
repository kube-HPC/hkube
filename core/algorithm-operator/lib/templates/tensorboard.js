const { TENSORBOARD } = require('../consts/containers');

const deploymentBoardTemplate = (boardId = '') => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: `board-${boardId}`,
        labels: {
            app: `board-${boardId}`,
            group: 'hkube',
            core: 'true',
            'metrics-group': TENSORBOARD,
            type: TENSORBOARD
        }
    },
    spec: {
        replicas: 1,
        selector: {
            matchLabels: {
                app: `board-${boardId}`
            }
        },
        template: {
            metadata: {
                labels: {
                    app: `board-${boardId}`,
                    group: 'hkube',
                    'metrics-group': TENSORBOARD,
                    type: TENSORBOARD
                }
            },
            spec: {
                serviceAccountName: 'board-serviceaccount',
                containers: [
                    {
                        name: TENSORBOARD,
                        image: 'hkube/tensorboard:5.0',
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
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
                                name: 'CLUSTER_NAME',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
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
                                name: 'S3_USE_HTTPS',
                                value: '0'
                            }
                        ],
                        port: {
                            containerPort: 6006
                        }
                    }
                ]

            }
        }
    }
});

const dockerVolumes = {
    volumeMounts: [
        {
            name: 'dockersock',
            mountPath: '/var/run/docker.sock'
        }
    ],
    volumes: [
        {
            name: 'dockersock',
            hostPath: {
                path: '/var/run/docker.sock'
            }
        }
    ]
};


const boardService = (boardID = '') => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `board-service-${boardID}`,
        annotations: {
            'prometheus.io/scrape': 'true'
        },
        labels: {
            app: `board-${boardID}`,
            group: 'hkube',
            core: 'true',
            type: TENSORBOARD
        }
    },
    spec: {
        selector: {
            'metrics-group': TENSORBOARD,
            group: 'hkube',
            app: `board-${boardID}`,
        },
        ports: [
            {
                name: 'metrics',
                port: 80,
                targetPort: 6006
            }
        ]
    }
});

const boardIngress = (boardId = '', { ingressHost, ingressPrefix = '' } = {}) => ({
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata: {
        name: `ingress-board-${boardId}`,
        annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': '/',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000'
        },
        labels: {
            app: `ingress-${TENSORBOARD}`,
            core: 'true',
            type: TENSORBOARD
        }
    },
    spec: {
        rules: [
            {
                http: {
                    paths: [{
                        path: `${ingressPrefix}/hkube/board/${boardId}`,
                        backend: {
                            serviceName: `board-service-${boardId}`,
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
    deploymentBoardTemplate,
    boardService,
    boardIngress,
    dockerVolumes
};
