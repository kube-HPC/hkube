const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const swagger = require('../api/rest-api/swagger.json')
const { request } = require('./utils');

describe('Method Not Allowed', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    Object.entries(swagger.paths).filter(([k, v]) => Object.keys(v).length === 1 && k !== '/store/algorithms/apply').forEach(([k, v]) => {
        it(`${k} - should throw Method Not Allowed`, async () => {
            const met = Object.keys(v)[0].toUpperCase();
            const method = met === 'GET' ? 'POST' : 'GET';
            const uri = `${restUrl}${k}`;
            const options = {
                method,
                uri,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.METHOD_NOT_ALLOWED);
            expect(response.body.error.message).to.equal('Method Not Allowed');
        });
    })
});


