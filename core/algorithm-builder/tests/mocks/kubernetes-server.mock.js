const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const configMapRes = {
    data: {
        'versions.json': JSON.stringify({ name: 'hkube-versions', versions: [{ project: 'nodejs-env', tag: 'v1.2.0' }] }),
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

