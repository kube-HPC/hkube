const { TENSORBOARD } = require('../consts/containers');

const deploymentBoardTemplate = (boardId = '') => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: `board-${boardId}`,
        labels: {
            app: `board-${boardId}`,
            'board-id': `${boardId}`,
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
                containers: [
                    {
                        name: TENSORBOARD,
                        image: `hkube/${TENSORBOARD}:11.0`,
                        env: [
                            {
                                name: 'DEFAULT_STORAGE',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'DEFAULT_STORAGE'
                                    }
                                }
                            },
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

const boardService = (boardID = '') => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `board-service-${boardID}`,
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
};
