const { expect } = require('chai');
const nock = require('nock');
const { StatusCodes } = require('http-status-codes');
const { request } = require('./utils');
let restPath = null;
const pipelineName = 'exec_raw';

const runRaw = ({ nodes, name = pipelineName }) => {
    const options = {
        uri: `${restPath}/exec/raw`,
        body: {
            name,
            nodes
        }
    };
    return request(options);
};

describe('DataSources', () => {
    before(() => {
        restPath = testParams.restUrl;
        config = testParams.config;
        const { protocol, host, port, prefix } = config.dataSourceService;
        const serviceURI = `${protocol}://${host}:${port}`;
        const path = `/${prefix}`;
        nock(serviceURI).persist().post(path, [{ name: 'exist' }]).reply(200);
        nock(serviceURI).persist().post(path, [{ snapshot: 'exist' }]).reply(200);
        nock(serviceURI).persist().post(path, [{ name: 'non-exist' }]).reply(400, { error: { code: 400, message: 'dataSource non-exist Not Found' } });
        nock(serviceURI).persist().post(path, [{ snapshot: 'non-exist' }]).reply(400, { error: { code: 400, message: 'snapshot non-exist Not Found' } });
    });
    describe('/exec/raw', () => {
        it('should throw invalid kind', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'non',
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`data.nodes[0].kind should be equal to one of the allowed values (dataSource)`);
        });
        it('should throw no dataSource provided', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource'
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`you must provide a valid dataSource`);
        });
        it('should throw dataSource non-exist Not Found', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: "non-exist"
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`dataSource non-exist Not Found`);
        });
        it('should throw snapshot non-exist Not Found', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        snapshot: "non-exist"
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`snapshot non-exist Not Found`);
        });
        it('should throw need exactly one schema', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist',
                        snapshot: 'exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`data.nodes[0].dataSource should match exactly one schema in oneOf`);
        });
        it('should success to exec pipeline with data-source name', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
        });
        it('should success to exec pipeline with data-source snapshot', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        snapshot: 'exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
        });
    });
});
