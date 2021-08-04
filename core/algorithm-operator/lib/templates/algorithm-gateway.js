const { nodeKind } = require('@hkube/consts');
const { getIngressParams } = require('../helpers/kubernetes-utils');

const gatewayService = ({ algorithmName }) => ({
    kind: 'Service',
    apiVersion: 'v1',
    metadata: {
        name: `service-gateway-${algorithmName}`,
        annotations: {
            'prometheus.io/scrape': 'true'
        },
        labels: {
            app: nodeKind.Gateway,
            group: 'hkube',
            core: 'true',
            type: nodeKind.Gateway,
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
                name: 'gateway',
                port: 80,
                targetPort: 3005
            }
        ]
    }
});

const gatewayIngress = ({ algorithmName, gatewayName }, { ingressHost, ingressPrefix = '', ingressUseRegex = false, ingressClass = 'nginx' } = {}) => {
    const { apiVersion, backend, pathType } = getIngressParams(`service-gateway-${algorithmName}`, 80);
    return ({
        apiVersion,
        kind: 'Ingress',
        metadata: {
            name: `ingress-gateway-${algorithmName}`,
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
                'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
                'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000',
                'kubernetes.io/ingress.class': ingressClass
            },
            labels: {
                app: `ingress-${nodeKind.Gateway}`,
                core: 'true',
                type: nodeKind.Gateway,
                'algorithm-name': algorithmName,
            }
        },
        spec: {
            rules: [
                {
                    http: {
                        paths: [{
                            path: ingressUseRegex ? `${ingressPrefix}/hkube/gateway/${gatewayName}(/|$)(.*)` : `${ingressPrefix}/hkube/gateway/${gatewayName}`,
                            backend,
                            pathType
                        }]
                    },
                    host: ingressHost || undefined
                }
            ]
        }
    });
};

module.exports = {
    gatewayService,
    gatewayIngress
};
