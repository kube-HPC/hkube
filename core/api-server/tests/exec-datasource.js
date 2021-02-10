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
const getJob = (jobId) => {
    const options = {
        uri: `${restPath}/exec/pipelines/${jobId}`,
        method: 'GET'
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
        const qs1 = querystring.stringify({ id: 'exist' });
        const qs2 = querystring.stringify({ name: 'exist', snapshot_name: 'exist' });
        const qs3 = querystring.stringify({ id: 'non-exist' });
        const qs4 = querystring.stringify({ name: 'exist', snapshot_name: 'non-exist' });
        const qs5 = querystring.stringify({ name: 'non-exist' });
        nock(serviceURI).persist().get(`/validate?${qs0}`).reply(200, { id: '123' });
        nock(serviceURI).persist().get(`/validate?${qs1}`).reply(200);
        nock(serviceURI).persist().get(`/validate?${qs2}`).reply(200);
        nock(serviceURI).persist().get(`/validate?${qs3}`).reply(400, { error: { code: 400, message: 'id non-exist Not Found' } });
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
                        snapshot: {
                            name: 'non-exist'
                        }
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`snapshotName non-exist Not Found`);
        });
        it('should throw id Not Found', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        id: 'non-exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`id non-exist Not Found`);
        });
        it('should success to exec pipeline with data-source id', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        id: 'exist'
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
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
        it('should update pipeline.dataSource descriptor to id when running by name only', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    // this dataSource should be replaced to an id
                    dataSource: { name: 'exist' }
                }, {
                    nodeName: 'B',
                    kind: 'dataSource',
                    dataSource: { id: 'exist' }
                }, {
                    nodeName: 'C',
                    kind: 'dataSource',
                    dataSource:
                    {
                        name: 'exist',
                        snapshot: {
                            name: 'exist'
                        }
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
            const job = await getJob(response.body.jobId);
            const [byName, ...rest] = job.body.nodes;
            expect(byName.dataSource).to.not.haveOwnProperty('name');
            expect(byName.dataSource).to.haveOwnProperty('id');
            expect(byName.dataSource.id).to.eql('123');
            expect(rest).to.eql(pipeline.nodes.slice(1).map(node => ({ ...node, input: [] })));
        });
        it('should success to exec pipeline with data-source snapshotName', async () => {
            const pipeline = {
                nodes: [{
                    nodeName: 'A',
                    kind: 'dataSource',
                    dataSource: {
                        name: 'exist',
                        snapshot: {
                            name: 'exist'
                        }
                    }
                }]
            };
            const response = await runRaw(pipeline);
            expect(response.body).to.have.property('jobId');
        });
    });
});
