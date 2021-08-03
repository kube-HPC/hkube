const { nodeKind } = require('@hkube/consts');
const { getIngressParams } = require('../helpers/kubernetes-utils');

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
            'algorithm-name': `${algorithmName}`,
            'metrics-group': 'workers',
            group: 'hkube'
        },
        ports: [
            {
                name: nodeKind.Debug,
                port: 80,
                targetPort: 3005
            }
        ]
    }
});

const debugIngress = ({ algorithmName, debugName }, { ingressHost, ingressPrefix = '', ingressUseRegex = false } = {}) => {
    const { apiVersion, backend, pathType } = getIngressParams(`service-debug-${algorithmName}`, 80);
    const ret = {
        apiVersion,
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
                            path: ingressUseRegex ? `${ingressPrefix}/hkube/debug/${debugName}(/|$)(.*)` : `${ingressPrefix}/hkube/debug/${debugName}`,
                            backend,
                            pathType
                        }]
                    },
                    host: ingressHost || undefined
                }
            ]
        }
    };
    return ret;
};

module.exports = {
    debugService,
    debugIngress
};
