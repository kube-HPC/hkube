const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const storageManager = require('@hkube/storage-manager');
const stateManager = require('../lib/state/state-manager');
const { webhookStub } = require('./mocks');
const { delay, request } = require('./utils');
let restUrl;

describe('Webhooks', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('Results', () => {
        it('should succeed to send webhook', async () => {
            return new Promise(async (resolve) => {
                let jobId = null;
                webhookStub.on('result', async (req) => {
                    if (req.body.jobId === jobId) {
                        expect(req.body).to.have.property('data');
                        expect(req.body).to.have.property('jobId');
                        expect(req.body).to.have.property('status');
                        expect(req.body).to.have.property('timestamp');

                        const status = {
                            uri: restUrl + '/exec/results/' + jobId,
                            method: 'GET'
                        };
                        const responseStatus = await request(status);
                        expect(req.body).to.deep.equal(responseStatus.body);
                        return resolve();
                    }
                });
                const stored = {
                    uri: restUrl + '/exec/stored',
                    body: { name: 'webhookFlow' }
                };
                const response = await request(stored);
                jobId = response.body.jobId;

                const results = {
                    jobId,
                    status: 'completed',
                    level: 'info',
                    data: [{ res1: 400 }, { res2: 500 }]
                }
                await stateManager.setJobStatus(results);
                let link = await storageManager.hkubeResults.put({ jobId, data: results.data })
                results.data = {};
                results.data.storageInfo = link;
                await stateManager.setJobResults(results);
            });
        });
        it('should throw webhooks validation error of should match format "url', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    webhooks: {
                        result: 'not_a_url'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.webhooks.result should match format "url"');
        });
        it('should throw webhooks validation error of NOT have additional properties', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    webhooks: {
                        result2: 'http://localhost'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.webhooks should NOT have additional properties');
        });
        it('should succeed to store pipeline with webhooks', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    webhooks: {
                        result: 'http://localhost'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should throw error when no such webhook results jobId', async function () {
            const options = {
                method: 'GET',
                uri: `${restUrl}/webhooks/results/no_such`
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('webhook no_such Not Found');
        });
        it('should succeed to send webhook and get results', async () => {
            let options = {
                uri: restUrl + '/exec/stored',
                body: { name: 'webhookFlow' }
            };
            const response = await request(options);
            jobId = response.body.jobId;

            const results = {
                jobId,
                status: 'completed',
                level: 'info',
                data: [{ res1: 400 }, { res2: 500 }]
            }
            await stateManager.setJobStatus(results);
            let link = await storageManager.hkubeResults.put({ jobId, data: results.data })
            results.data = {};
            results.data.storageInfo = link;
            await stateManager.setJobResults(results);

            await delay(1000);

            options = {
                method: 'GET',
                uri: restUrl + '/webhooks/results/' + jobId
            };
            const response2 = await request(options);

            expect(response2.body).to.have.property('httpResponse');
            expect(response2.body.httpResponse).to.have.property('statusCode');
            expect(response2.body.httpResponse).to.have.property('statusMessage');
            expect(response2.body).to.have.property('jobId');
            expect(response2.body).to.have.property('url');
            expect(response2.body).to.have.property('pipelineStatus');
            expect(response2.body).to.have.property('responseStatus');
        });
    });
    describe('Progress', () => {
        it('should succeed to send webhook', async () => {
            let jobId = null;
            webhookStub.on('progress', async (req) => {
                if (req.body.jobId === jobId) {
                    expect(req.body).to.have.property('jobId');
                    expect(req.body).to.have.property('status');
                    expect(req.body).to.have.property('timestamp');

                    const status = {
                        uri: restUrl + '/exec/status/' + jobId,
                        method: 'GET'
                    };
                    const responseStatus = await request(status);
                    expect(req.body).to.deep.equal(responseStatus.body);
                }
            });
            const stored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'webhookFlow' }
            };
            const response = await request(stored);
            jobId = response.body.jobId;
        });
        it('should throw webhooks validation error of should match format "url', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    webhooks: {
                        progress: 'not_a_url'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.webhooks.progress should match format "url"');
        });
        it('should throw webhooks validation error of NOT have additional properties', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    webhooks: {
                        progress2: 'http://localhost'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.webhooks should NOT have additional properties');
        });
        it('should succeed to store pipeline with webhooks', async () => {
            const options = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ],
                    webhooks: {
                        progress: 'http://localhost'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('jobId');
        });
        it('should throw error when no such webhook status jobId', async function () {
            const options = {
                method: 'GET',
                uri: `${restUrl}/webhooks/status/no_such`
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('webhook no_such Not Found');
        });
        it('should throw error when no such jobId', async function () {
            const options = {
                method: 'GET',
                uri: `${restUrl}/webhooks/no_such`
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('webhook no_such Not Found');
        });
        it('should succeed and return webhooks progress', async function () {
            this.timeout(5000);
            const options1 = {
                uri: restUrl + '/exec/stored',
                body: { name: 'webhookFlow' }
            };
            const response = await request(options1);

            await delay(1000);

            const options2 = {
                method: 'GET',
                uri: `${restUrl}/webhooks/status/${response.body.jobId}`
            };
            const response2 = await request(options2);

            expect(response2.body).to.have.property('httpResponse');
            expect(response2.body.httpResponse).to.have.property('statusCode');
            expect(response2.body.httpResponse).to.have.property('statusMessage');
            expect(response2.body).to.have.property('jobId');
            expect(response2.body).to.have.property('url');
            expect(response2.body).to.have.property('pipelineStatus');
            expect(response2.body).to.have.property('responseStatus');
        });
        it('should succeed and return webhook by jobId', async function () {
            this.timeout(5000);
            const options1 = {
                uri: restUrl + '/exec/stored',
                body: { name: 'webhookFlow' }
            };
            const response = await request(options1);
            const jobId = response.body.jobId;
            const results = {
                jobId,
                status: 'completed',
                level: 'info',
                data: [{ res1: 400 }, { res2: 500 }]
            }

            await stateManager.setJobResults(results);

            await delay(2000);

            const options2 = {
                method: 'GET',
                uri: `${restUrl}/webhooks/webhookFlow?limit=3`
            };
            const response2 = await request(options2);
            expect(response2.body[0]).to.have.property('jobId');
            expect(response2.body[0]).to.have.property('result');
            expect(response2.body[0]).to.have.property('progress');
        });
    });
});
