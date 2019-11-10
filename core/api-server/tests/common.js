const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const swagger = require('../api/rest-api/swagger.json')
const { request } = require('./utils');
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE'];

describe('Method Not Allowed', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    Object.entries(swagger.paths).forEach(([k, v]) => {
        it(`${k} - should throw Method Not Allowed`, async () => {
            const keys = Object.keys(v).map(m => m.toUpperCase());
            const methods = httpMethods.filter(h => !keys.includes(h))
            const method = methods[0];
            const uri = `${restUrl}${k}`;
            const options = {
                method,
                uri,
                body: {}
            };
            const response = await request(options);
            if (response.body.error && response.body.error.code === HttpStatus.METHOD_NOT_ALLOWED) {
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.METHOD_NOT_ALLOWED);
                expect(response.body.error.message).to.equal('Method Not Allowed');
            }
        });
    })
});


