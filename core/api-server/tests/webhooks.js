const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const nock = require('nock');
const stateManager = require('../lib/state/state-manager');
const { delay, request } = require('./utils');
let restUrl;

describe('Webhooks', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        nock('http://my-webhook-server-2').persist().post('/webhook/result').reply(200);
        nock('http://my-webhook-server-2').persist().post('/webhook/progress').reply(200);
    });
    describe('Validation', () => {
        it('should throw webhooks validation error of result should match format "url', async () => {
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
        it('should throw webhooks validation error of progress should match format "url', async () => {
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
                        no_such_prop: 'http://localhost'
                    }
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.webhooks should NOT have additional properties (no_such_prop)');
        });
    });
    describe('Results', () => {
        it('should succeed to send webhook result', async () => {
            return new Promise(async (resolve) => {
                nock('http://my-webhook-server-1')
                    .post('/webhook/result')
                    .reply(200, async (uri, requestBody) => {
                        expect(requestBody).to.have.property('data');
                        expect(requestBody).to.have.property('jobId');
                        expect(requestBody).to.have.property('status');
                        expect(requestBody).to.have.property('timestamp');

                        const status = {
                            uri: `${restUrl}/exec/results/${requestBody.jobId}`,
                            method: 'GET'
                        };
                        const response = await request(status);
                        expect(response.body.jobId).to.eql(requestBody.jobId);
                        expect(response.body.status).to.eql(requestBody.status);
                        expect(response.body.data).to.eql(requestBody.data);
                        return resolve();
                    });

                const stored = {
                    uri: `${restUrl}/exec/stored`,
                    body: { name: 'webhookFlow1' }
                };
                const response = await request(stored);

                const results = {
                    jobId: response.body.jobId,
                    status: 'completed',
                    data: [{ res1: 400 }, { res2: 500 }]
                }
                await stateManager.updateJobStatus(results);
                await stateManager.updateJobResult(results);
            });
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
                body: { name: 'webhookFlow2' }
            };
            const response = await request(options);
            jobId = response.body.jobId;

            const results = {
                jobId,
                status: 'completed',
                level: 'info',
                data: [{ res1: 400 }, { res2: 500 }]
            }
            await stateManager._etcd.jobs.results.set(results);
            await delay(1000);

            options = {
                method: 'GET',
                uri: `${restUrl}/webhooks/results/${jobId}`
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
        it('should succeed to send webhook progress', async () => {
            return new Promise(async (resolve) => {
                nock('http://my-webhook-server-1')
                    .post('/webhook/progress')
                    .reply(200, async (uri, requestBody) => {
                        expect(requestBody).to.have.property('jobId');
                        expect(requestBody).to.have.property('level');
                        expect(requestBody).to.have.property('pipeline');
                        expect(requestBody).to.have.property('status');
                        expect(requestBody).to.have.property('timestamp');

                        const status = {
                            uri: `${restUrl}/exec/status/${requestBody.jobId}`,
                            method: 'GET'
                        };
                        const response = await request(status);
                        expect(response.body.jobId).to.eql(requestBody.jobId);
                        expect(response.body.status).to.eql(requestBody.status);
                        expect(response.body.data).to.eql(requestBody.data);
                        return resolve();

                    })
                const stored = {
                    uri: restUrl + '/exec/stored',
                    body: { name: 'webhookFlow1' }
                };
                await request(stored);
            });
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
                uri: `${restUrl}/webhooks/list/no_such`
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('webhook no_such Not Found');
        });
        it('should succeed and return webhooks progress', async function () {
            const options1 = {
                uri: restUrl + '/exec/stored',
                body: { name: 'webhookFlow2' }
            };
            const response = await request(options1);

            await delay(1000);

            const options2 = {
                method: 'GET',
                uri: `${restUrl}/webhooks/status/${response.body.jobId} `
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
            const options1 = {
                uri: restUrl + '/exec/stored',
                body: { name: 'webhookFlow2' }
            };
            const response = await request(options1);
            const jobId = response.body.jobId;
            const results = {
                jobId,
                status: 'completed',
                level: 'info',
                data: [{ res1: 400 }, { res2: 500 }]
            }

            await stateManager.updateJobResult(results);

            await delay(2000);

            const options2 = {
                method: 'GET',
                uri: `${restUrl}/webhooks/list/${jobId} `
            };
            const response2 = await request(options2);
            expect(response2.body).to.have.property('jobId');
            expect(response2.body).to.have.property('result');
            expect(response2.body).to.have.property('progress');
        });
    });
});
