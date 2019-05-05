const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const { pods, nodes } = require('../stub/resources');
const app = express();

const configMapRes = {
    data: {
        'versions.json': JSON.stringify({ name: 'hkube-versions', versions: [{ project: 'worker', tag: 'v2.1.0' }] }),
        'registry.json': JSON.stringify('cloud.docker.com'),
        'clusterOptions.json': JSON.stringify({ useNodeSelector: true }),
    }
}

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
}

module.exports = new MockClient();

