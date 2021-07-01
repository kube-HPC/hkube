const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;
let restPath = null;
const getJob = (jobId) => {
    const options = {
        uri: `${restUrl}/exec/pipelines/${jobId}`,
        method: 'GET'
    };
    return request(options);
};
describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/algorithm', () => {
        before(() => {
            restPath = `${restUrl}/exec/algorithm`;
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: {}
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: ''
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
        });
        it('should throw validation error of nodes.input should be array', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'string',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: null
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
        });
        it('should throw validation error of algorithm not found', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'no-such-algorithm',
                    input: []
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`algorithm ${options.body.name} Not Found`);
        });
        it('should succeed and return job id and not set debug kind', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'eval-alg',
                    input: []
                }
            };
            const {body: response} = await request(options);
            expect(response).to.have.property('jobId');
            const {body: job}=await getJob(response.jobId);
            expect(job.nodes[0].kind).to.eql('algorithm');
            expect(job.types).to.not.contain('debug');
            expect(job.types).to.contain('algorithm');
        });
        it('should set debug nodeKind', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'eval-alg',
                    input: [],
                    debug: true
                }
            };
            const {body: response} = await request(options);
            const {body: job}=await getJob(response.jobId);
            expect(job.nodes[0].kind).to.eql('debug');
            expect(job.types).to.contain('debug');
            expect(job.types).to.contain('algorithm');
        });
    });
});
