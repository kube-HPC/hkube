const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Experiment', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('delete /experiment', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/experiment`;
        });
        it.only('should fail to delete main experiment', async () => {
            const options = {
                uri: restPath + '/main',
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('main experiment cannot be deleted');
        });
    });
});
