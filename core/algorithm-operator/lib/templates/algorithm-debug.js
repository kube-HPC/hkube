const { nodeKind } = require('@hkube/consts');

const debugService = ({ algorithmName }) => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `service-debug-${algorithmName}`,
        annotations: {
            'prometheus.io/scrape': 'true'
        },
        labels: {
            app: nodeKind.Debug,
            group: 'hkube',
            core: 'true',
            type: nodeKind.Debug,
            'algorithm-name': algorithmName,
        }
    },
    spec: {
        selector: {
            'algorithm-name': algorithmName,
            'metrics-group': 'workers',
            group: 'hkube'
        },
        ports: [
            {
                name: 'debug',
                port: 80,
                targetPort: 3005
            }
        ]
    }
});

const debugIngress = ({ algorithmName }, { ingressHost, ingressPrefix = '', ingressUseRegex = false } = {}) => ({
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata: {
        name: `ingress-debug-${algorithmName}`,
        annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000'
        },
        labels: {
            app: `ingress-${nodeKind.Debug}`,
            core: 'true',
            type: nodeKind.Debug,
            'algorithm-name': algorithmName,
        }
    },
    spec: {
        rules: [
            {
                http: {
                    paths: [{
                        path: ingressUseRegex ? `${ingressPrefix}/hkube/debug/${algorithmName}(/|$)(.*)` : `${ingressPrefix}/hkube/debug/${algorithmName}`,
                        backend: {
                            serviceName: `service-debug-${algorithmName}`,
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
    debugService,
    debugIngress
};
