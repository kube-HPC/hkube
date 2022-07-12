const { expect } = require('chai');
const configIt = require('@hkube/config');
const { main: config, logger } = configIt.load();
const {request } = require('graphql-request');
const algorithmsQuery = require('./queries/algorithm-query');

let baseUrl;
describe.only('graphql algorithms get', () => {
    before(async() => {
       baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
       graphqlUrl = `${baseUrl}/graphql`;
    })
    it('should get a list of all algorithms', async () => {
        const response = await request(graphqlUrl, algorithmsQuery);
        expect(response.algorithms.list).to.be.an('array');
        expect(response.algorithms.list[0]).to.have.property('name');
        expect(response.algorithms.list[0]).to.have.property('algorithmImage');
    });
    it('should return correct algorithms count', async () => {
        const response = await request(graphqlUrl, algorithmsQuery);
        expect(response.algorithms.algorithmsCount).to.equal(response.algorithms.list.length);
    })

});

