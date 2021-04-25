const { nodeKind } = require('@hkube/consts');

const gatewayService = algorithmName => ({
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
            'metrics-group': nodeKind.Gateway,
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

const gatewayIngress = (algorithmName, { ingressHost, ingressPrefix = '', ingressUseRegex = false } = {}) => ({
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata: {
        name: `ingress-gateway-${algorithmName}`,
        annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': ingressUseRegex ? '/$2' : '/',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '50000'
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
                        path: ingressUseRegex ? `${ingressPrefix}/hkube/gateway/${algorithmName}(/|$)(.*)` : `${ingressPrefix}/hkube/gateway/${algorithmName}`,
                        backend: {
                            serviceName: `service-gateway-${algorithmName}`,
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
    gatewayService,
    gatewayIngress
};
