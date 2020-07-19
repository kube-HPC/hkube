const { TENSORBOARD } = require('../consts/containers');

const deploymentBoardTemplate = (boardReference = '') => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: `board-${boardReference}`,
        labels: {
            app: `board-${boardReference}`,
            'board-id': `${boardReference}`,
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
                app: `board-${boardReference}`
            }
        },
        template: {
            metadata: {
                labels: {
                    app: `board-${boardReference}`,
                    group: 'hkube',
                    'metrics-group': TENSORBOARD,
                    type: TENSORBOARD
                }
            },
            spec: {
                containers: [
                    {
                        name: TENSORBOARD,
                        image: `hkube/${TENSORBOARD}`,
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

const boardService = (boardReference = '') => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `board-service-${boardReference}`,
        labels: {
            app: `board-${boardReference}`,
            group: 'hkube',
            core: 'true',
            type: TENSORBOARD
        }
    },
    spec: {
        selector: {
            'metrics-group': TENSORBOARD,
            group: 'hkube',
            app: `board-${boardReference}`,
        },
        ports: [
            {
                port: 80,
                targetPort: 6006
            }
        ]
    }
});

const boardIngress = (boardReference = '', { ingressHost, ingressPrefix = '', ingressUseRegex = false } = {}) => ({
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata: {
        name: `ingress-board-${boardReference}`,
        annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
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
                        path: ingressUseRegex ? `${ingressPrefix}/hkube/board/${boardReference}(/|$)(.*)` : `${ingressPrefix}/hkube/board/${boardReference}`,
                        backend: {
                            serviceName: `board-service-${boardReference}`,
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
