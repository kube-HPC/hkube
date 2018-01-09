const EventEmitter = require('events');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const app = express();

class WebhookStub extends EventEmitter {
    start() {
        return new Promise((resolve, reject) => {
            const httpCodes = Object.keys(http.STATUS_CODES);

            app.use(bodyParser.json());

            app.post('/webhook/result', (req, res) => {
                const httpCode = 200;
                res.status(httpCode).json({ message: httpCodes[httpCode] });
                this.emit('result', req);
            });

            app.post('/webhook/progress', (req, res) => {
                const httpCode = 200;
                res.status(httpCode).json({ message: httpCodes[httpCode] });
                this.emit('progress', req);
            });

            app.listen(3002, () => {
                console.log('webhook stub listening on port 3002');
                return resolve();
            });
        });
    }
}

module.exports = new WebhookStub();
