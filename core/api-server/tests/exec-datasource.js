const { expect } = require('chai');
const nock = require('nock');
const { StatusCodes } = require('http-status-codes');
const querystring = require('querystring');
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
        const serviceURI = `${protocol}://${host}:${port}/${prefix}/datasource`;
        const qs0 = querystring.stringify({ name: 'exist' });
        const qs1 = querystring.stringify({ name: 'exist', version_id: 'exist' });
        const qs2 = querystring.stringify({ name: 'exist', snapshot_name: 'exist' });
        const qs3 = querystring.stringify({ name: 'exist', version_id: 'non-exist' });
        const qs4 = querystring.stringify({ name: 'exist', snapshot_name: 'non-exist' });
        const qs5 = querystring.stringify({ name: 'non-exist' });
        nock(serviceURI).persist().get(`/validate?${qs0}`).reply(200);
        nock(serviceURI).persist().get(`/validate?${qs1}`).reply(200);
        nock(serviceURI).persist().get(`/validate?${qs2}`).reply(200);
        nock(serviceURI).persist().get(`/validate?${qs3}`).reply(400, { error: { code: 400, message: 'versionId non-exist Not Found' } });
        nock(serviceURI).persist().get(`/validate?${qs4}`).reply(400, { error: { code: 400, message: 'snapshotName non-exist Not Found' } });
        nock(serviceURI).persist().get(`/validate?${qs5}`).reply(400, { error: { code: 400, message: 'dataSource non-exist Not Found' } });
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
        it('should throw dataSource Not Found', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'non-exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`dataSource non-exist Not Found`);
        });
        it('should throw snapshotName Not Found', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist',
                        snapshotName: 'non-exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`snapshotName non-exist Not Found`);
        });
        it('should throw versionId Not Found', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist',
                        versionId: 'non-exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`versionId non-exist Not Found`);
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
        it('should success to exec pipeline with data-source snapshotName', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist',
                        snapshotName: 'exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
        });
        it('should success to exec pipeline with data-source versionId', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist',
                        versionId: 'exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
        });
    });
});
