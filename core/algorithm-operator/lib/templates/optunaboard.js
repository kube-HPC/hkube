const { OPTUNABOARD } = require('../consts/containers');
const { getIngressParams } = require('../helpers/kubernetes-utils');

const deploymentBoardTemplate = (boardReference = '', id, { ingressPrefix }) => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: `optunaboard-${boardReference}`,
        labels: {
            app: `optunaboard-${boardReference}`,
            'optunaboard-id': `${boardReference}`,
            group: 'hkube',
            core: 'true',
            'metrics-group': OPTUNABOARD,
            type: OPTUNABOARD
        }
    },
    spec: {
        replicas: 1,
        selector: {
            matchLabels: {
                app: `optunaboard-${boardReference}`
            }
        },
        template: {
            metadata: {
                labels: {
                    app: `optunaboard-${boardReference}`,
                    group: 'hkube',
                    'metrics-group': OPTUNABOARD,
                    type: OPTUNABOARD
                }
            },
            spec: {
                containers: [
                    {
                        name: OPTUNABOARD,
                        image: 'hkube/optuna-dashboard:v1.2.10',
                        env: [
                            {
                                name: 'OPTUNADB',
                                value: `/hkube/datasciencemetrics-storage/${id}`
                            },
                            {
                                name: 'BOARD_REFERENCE',
                                value: `${boardReference}`
                            },
                            {
                                name: 'INGRESS_PREFIX',
                                value: `${ingressPrefix}`
                            }

                        ],
                        port: {
                            containerPort: 8080
                        },
                        volumeMounts: [
                            {
                                mountPath: '/hkube/datasciencemetrics-storage',
                                name: 'datasciencemetrics-storage'
                            }
                        ]
                    }
                ],
                volumes: [
                    {
                        name: 'datasciencemetrics-storage',
                        persistentVolumeClaim: {
                            claimName: 'hkube-datasciencemetrics'
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
        name: `optunaboard-service-${boardReference}`,
        labels: {
            app: `optunaboard-${boardReference}`,
            group: 'hkube',
            core: 'true',
            type: OPTUNABOARD
        }
    },
    spec: {
        selector: {
            'metrics-group': OPTUNABOARD,
            group: 'hkube',
            app: `optunaboard-${boardReference}`,
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
    const { apiVersion, backend, pathType } = getIngressParams(`optunaboard-service-${boardReference}`, 80);
    return {
        apiVersion,
        kind: 'Ingress',
        metadata: {
            name: `ingress-optunaboard-${boardReference}`,
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
                'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
                'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000',
                'kubernetes.io/ingress.class': ingressClass
            },
            labels: {
                app: `ingress-${OPTUNABOARD}`,
                core: 'true',
                type: OPTUNABOARD
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
