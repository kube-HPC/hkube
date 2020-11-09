const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restPath = null;
const pipelineName = 'exec_raw';

/** @type {(props: {nodes: {nodeName: string, algorithmName: string, input: any[]}[], name?:string}  ) => Promise<any> }*/
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

describe('Executions', () => {
    before(() => {
        restPath = testParams.restUrl;
        config = testParams.config;
    });
    describe('/exec/raw', () => {
        it('should throw invalid reserved name dataSource', async () => {
            const response = await runRaw({
                nodes: [{
                    nodeName: 'dataSource',
                    algorithmName: 'green-alg',
                    input: [1, 2, 3]
                }]
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`pipeline ${pipelineName} has invalid reserved name dataSource`);
        });
        it('should throw invalid input syntax for input @dataSource', async () => {
            const response = await runRaw({
                nodes: [{
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: ['@dataSource']
                }]
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('invalid input syntax, ex: @dataSource.<dataSourceName>/<fileName>');
        });
        it('should throw invalid input syntax for input @dataSource/models', async () => {
            const response = await runRaw({
                nodes: [{
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: ['@dataSource/models']
                }]
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('invalid input syntax, ex: @dataSource.<dataSourceName>/<fileName>');
        });
        it('should throw invalid input syntax for input @dataSource/model', async () => {
            const response = await runRaw({
                name: 'data-sources',
                nodes: [{
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
                }]
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('dataSource models1, models2, models3, models4, images1, images2, images3 Not Found');
        });
    });
});
