const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { pipelineTypes } = require('@hkube/consts');
const { request } = require('./utils');
let restUrl, config;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        config = global.testParams.config;
    });
    describe('/exec/raw', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/raw`;
        });
        it('should throw invalid reserved name dataSource', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'dataSource',
                            algorithmName: 'green-alg',
                            input: [1, 2, 3]
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`pipeline ${options.body.name} has invalid reserved name dataSource`);
        });
        it('should throw invalid input syntax for input @dataSource', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'node1',
                            algorithmName: 'green-alg',
                            input: ['@dataSource']
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('invalid input syntax, ex: @dataSource.<dataSourceName>/<fileName>');
        });
        it('should throw invalid input syntax for input @dataSource/models', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'node1',
                            algorithmName: 'green-alg',
                            input: ['@dataSource/models']
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('invalid input syntax, ex: @dataSource.<dataSourceName>/<fileName>');
        });
        it('should throw invalid input syntax for input @dataSource/model', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'data-sources',
                    nodes: [
                        {
                            nodeName: 'node1',
                            algorithmName: 'green-alg',
                            input: [
                                '@dataSource.models1/file1',
                                '@dataSource.models1/file2',
                                '@dataSource.models2/file2',
                                '@dataSource.models2/file2',
                                '@dataSource.models3/file3',
                                '@dataSource.models4/file5',
                                '@dataSource.images1/file1',
                                '@dataSource.images2/file2',
                                '@dataSource.images3/file3',
                                '@dataSource.images3/file4',
                                '@dataSource.images3/file5',
                            ]
                        }
                    ]
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('dataSource models1, models2, models3, models4, images1, images2, images3 Not Found');
        });
    });
});
