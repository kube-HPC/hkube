const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
const querystring = require('querystring');
let restUrl;
let algorithmName = 'my-search-alg';

describe('Search', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/search', () => {
        let restPath = null;
        before(async () => {
            restPath = `${restUrl}/exec/search`;
            execRawPath = `${restUrl}/exec/raw`;

            const body = {
                name: algorithmName,
                algorithmImage: 'image'
            };
            const optionsAlg = {
                uri: `${restUrl}/store/algorithms/apply`,
                formData: {
                    payload: JSON.stringify(body)
                }
            };
            await request(optionsAlg);

            const optionsExec = {
                uri: execRawPath,
                body: {
                    name: 'exec_raw',
                    nodes: [{
                        nodeName: 'A',
                        algorithmName: body.name,
                        input: []
                    }]
                }
            };
            const limit = 10;
            await Promise.all(Array.from(Array(limit)).map(() => request(optionsExec)));
        });
        it('should throw validation error of limit range', async () => {
            const options = {
                uri: restPath,
                body: {
                    limit: 120,
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be <= 100");
        });
        it('GET: should succeed to search jobs', async () => {
            const limit = 5;
            const qs = querystring.stringify({ limit, algorithmName });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('hits');
            expect(response.body).to.have.property('cursor');
            expect(response.body).to.have.property('timeTook');
            expect(response.body.hits).to.have.lengthOf(limit);
        });
        it('POST: should succeed to search jobs', async () => {
            const limit = 5;
            const options = {
                uri: restPath,
                body: {
                    query: {
                        algorithmName,
                    },
                    limit,
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('hits');
            expect(response.body).to.have.property('cursor');
            expect(response.body).to.have.property('timeTook');
            expect(response.body.hits).to.have.lengthOf(limit);
        });
    });
});
