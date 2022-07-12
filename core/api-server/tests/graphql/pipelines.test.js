const { expect } = require('chai');
const configIt = require('@hkube/config');
const { main: config, logger } = configIt.load();
const {request } = require('graphql-request');
const pipelineQuery = require('./queries/pipeline-query');
const pipelineSnapshot = require('./snapshots/pipeline.snapshot');
let baseUrl;
describe('graphql pipelines get', () => {
    before(async() => {
       baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
       graphqlUrl = `${baseUrl}/graphql`;
    })
    it('should get a list of all pipelines', async () => {
        const response = await request(graphqlUrl, pipelineQuery);
        expect(response.pipelines.list).to.be.an('array');
        expect(response.pipelines.list[0]).to.have.property('name');
        expect(response.pipelines.list[0]).to.have.property('flowInput');
    });
    it.only('should return correct pipeline count', async () => {
        const response = await request(graphqlUrl, pipelineQuery);
        expect(response.pipelines.pipelinesCount).to.equal(response.pipelines.list.length);
    })

});

