const { OPTUNBOARD } = require('../consts/containers');
const { getIngressParams } = require('../helpers/kubernetes-utils');

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
            'metrics-group': OPTUNBOARD,
            type: OPTUNBOARD
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
                    'metrics-group': OPTUNBOARD,
                    type: OPTUNBOARD
                }
            },
            spec: {
                containers: [
                    {
                        name: OPTUNBOARD,
                        image: `hkube/${OPTUNBOARD}`,
                        env: [
                            {
                                name: 'SHARED_METRICS',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'SHARED_METRICS'
                                    }
                                }
                            },
                        ],
                        port: {
                            containerPort: 8080
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
            type: OPTUNBOARD
        }
    },
    spec: {
        selector: {
            'metrics-group': OPTUNBOARD,
            group: 'hkube',
            app: `board-${boardReference}`,
        },
        ports: [
            {
                port: 80,
                targetPort: 8080
            }
        ]
    }
});

const boardIngress = (boardReference = '', { ingressHost, ingressPrefix = '', ingressUseRegex = false, ingressClass = 'nginx' } = {}) => {
    const { apiVersion, backend, pathType } = getIngressParams(`board-service-${boardReference}`, 80);
    return {
        apiVersion,
        kind: 'Ingress',
        metadata: {
            name: `ingress-board-${boardReference}`,
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
                'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
                'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000',
                'kubernetes.io/ingress.class': ingressClass
            },
            labels: {
                app: `ingress-${OPTUNBOARD}`,
                core: 'true',
                type: OPTUNBOARD
            }
        },
        spec: {
            rules: [
                {
                    http: {
                        paths: [{
                            path: ingressUseRegex ? `${ingressPrefix}/hkube/board/${boardReference}(/|$)(.*)` : `${ingressPrefix}/hkube/board/${boardReference}`,
                            backend,
                            pathType
                        }]

                    },
                    host: ingressHost || undefined
                }
            ]
        }
    };
};

module.exports = {
    deploymentBoardTemplate,
    boardService,
    boardIngress,
};
