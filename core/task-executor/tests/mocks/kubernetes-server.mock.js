const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const { kaiValues } = require('../../lib/consts');
const { resources } = require('../stub');
const { 
    pods,
    nodes,
    persistentVolumeClaim,
    secret,
    configMap,
    customResourceDefinition,
    queues,
    limitRanges
} = resources;

const app = express();

const configMapRes = {
    data: {
        'versions.json': JSON.stringify({ name: 'hkube-versions', versions: [{ project: 'worker', tag: 'v2.1.0' }] }),
        'registry.json': JSON.stringify('cloud.docker.com'),
        'clusterOptions.json': JSON.stringify({ useNodeSelector: true }),
    }
}

let includeKaiResources = true; // toggle for Kai run-ai resources.

class MockClient {
    start(options) {
        return new Promise((resolve, reject) => {
            this._server = http.createServer(app);

            app.use(bodyParser.json());
            app.use('/', (req, res) => {
                if (req.url === '/api/v1/namespaces/default/configmaps/hkube-versions') {
                    res.json(configMapRes);
                    return;
                }
                if (req.url === '/api/v1/pods') {
                    res.json(pods);
                    return;
                }
                if (req.url === '/api/v1/nodes') {
                    res.json(nodes);
                    return;
                }
                if (req.url === '/api/v1/namespaces/default/persistentvolumeclaims/') {
                    res.json(persistentVolumeClaim);
                    return;
                }
                if (req.url === '/api/v1/namespaces/default/secrets/') {
                    res.json(secret);
                    return;
                }
                if (req.url === '/api/v1/namespaces/default/configmaps/') {
                    res.json(configMap);
                    return;
                }
                if (req.url === '/apis/apiextensions.k8s.io/v1/customresourcedefinitions') {
                    const filteredItems = includeKaiResources
                        ? customResourceDefinition.items
                        : customResourceDefinition.items.filter(crd => crd.metadata.name !== kaiValues.KUBERNETES.QUEUES_CRD_NAME);
                    res.json({ items: filteredItems });
                    return;
                }
                if (req.url === '/apis/scheduling.run.ai/v2/queues') {
                    if (!includeKaiResources) {
                        res.status(404).json({
                            kind: 'Status',
                            apiVersion: 'v1',
                            metadata: {},
                            status: 'Failure',
                            message: 'queues.scheduling.run.ai not found',
                            reason: 'NotFound',
                            code: 404
                        });
                        return;
                    }
                    res.json(queues);
                    return;
                }
                if (req.url === '/api/v1/limitranges') {
                    res.json(limitRanges);
                    return;
                }

                if (req.url.startsWith('/api/v1/limitranges/')) {
                    // extract the name if needed
                    const name = req.url.split('/').pop();
                    const item = limitRanges.items.find(lr => lr.metadata.name === name);
                    if (item) {
                        res.json(item);
                    } else {
                        res.status(404).json({
                            kind: 'Status',
                            apiVersion: 'v1',
                            metadata: {},
                            status: 'Failure',
                            message: `limitranges "${name}" not found`,
                            reason: 'NotFound',
                            code: 404
                        });
                    }
                    return;
                }
                res.json(req.body);
            });

            this._server.listen(options.port, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    setKaiCRDEnabled(enabled) {
        includeKaiResources = enabled;
    }
}

module.exports = new MockClient();

