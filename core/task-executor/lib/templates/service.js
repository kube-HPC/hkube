const { ALGORITHM_DEBUG } = require('../consts/containers');
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
    workerIngress,
    workerService
};
