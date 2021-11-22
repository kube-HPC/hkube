const { DEVENV } = require('../consts/containers');
const { getIngressParams } = require('../helpers/kubernetes-utils');

const deployment = (name, type) => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: `${type}-${name}`,
        labels: {
            name,
            group: 'hkube',
            core: 'true',
            'metrics-group': type,
            type: DEVENV,
            'devenv-type': type
        }
    },
    spec: {
        replicas: 1,
        selector: {
            matchLabels: {
                'devenv-type': type,
                name
            }
        },
        template: {
            metadata: {
                labels: {
                    'devenv-type': type,
                    name,
                    group: 'hkube',
                    'metrics-group': type,
                }
            },
            spec: {
                containers: [
                    {
                        name: DEVENV,
                        image: 'hkube/vscode-workspace:v2.2.2',
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
                            containerPort: 8080
                        }
                    }
                ]

            }
        }
    }
});

const service = (name, type) => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `${type}-service-${name}`,
        labels: {
            name,
            group: 'hkube',
            core: 'true',
            type: DEVENV,
            'devenv-type': type
        }
    },
    spec: {
        selector: {
            name,
            'devenv-type': type
        },
        ports: [
            {
                port: 8080,
                targetPort: 8080
            }
        ]
    }
});

const createIngressPath = (name, type) => `/hkube/${type}/${name}`;

const ingress = (name, type, { ingressHost, ingressPrefix = '', ingressUseRegex = false, ingressClass = 'nginx' } = {}) => {
    const { apiVersion, backend, pathType } = getIngressParams(`${type}-service-${name}`, 8080);
    const ingressPath = createIngressPath(name, type);
    return {
        apiVersion,
        kind: 'Ingress',
        metadata: {
            name: `ingress-${type}-${name}`,
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
                'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
                'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000',
                'kubernetes.io/ingress.class': ingressClass
            },
            labels: {
                name,
                group: 'hkube',
                core: 'true',
                type: DEVENV,
                'devenv-type': type
            }
        },
        spec: {
            rules: [
                {
                    http: {
                        paths: [{
                            path: ingressUseRegex ? `${ingressPrefix}${ingressPath}(/|$)(.*)` : `${ingressPrefix}${ingressPath}`,
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

const pvc = (name, type, size, storageClass) => (
    {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
            annotations: {
            },
            labels: {
            },
            name: `claim-${type}-${name}`
        },
        spec: {
            accessModes: [
                'ReadWriteOnce'
            ],
            resources: {
                requests: {
                    storage: `${size}Gi`
                }
            },
            storageClassName: storageClass ? `${storageClass}` : undefined
        }
    }
);

const volumes = (name, type) => ({
    name: 'storage-volume',
    persistentVolumeClaim: {
        claimName: `claim-${type}-${name}`
    }
});

const volumeMounts = () => ({
    name: 'storage-volume',
    mountPath: '/home/coder/project'
});
module.exports = {
    deployment,
    service,
    ingress,
    createIngressPath,
    storage: {
        pvc,
        volumes,
        volumeMounts
    }
};
