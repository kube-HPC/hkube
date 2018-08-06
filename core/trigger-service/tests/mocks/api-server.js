const uuidv4 = require('uuid/v4');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const app = express();

class ApiServer {
    init() {
        return new Promise((resolve) => {
            app.use(bodyParser.json());
            app.post('/internal/v1/exec/stored/cron', (req, res) => {
                const jobId = [req.body.name, uuidv4()].join('.');
                res.json({ jobId });
            });
            app.post('/internal/v1/exec/stored/pipeline', (req, res) => {
                const jobId = [req.body.parentJobId, req.body.name, uuidv4()].join('.');
                res.json({ jobId });
            });
            app.listen(3000, () => {
                console.log('api-server stub listening on port 3000');
                return resolve();
            });
        });
    }
}

module.exports = new ApiServer();
