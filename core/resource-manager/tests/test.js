
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const bootstrap = require('../bootstrap');

describe('Test', function () {
    before(async () => {
        await bootstrap.init();
    })
    describe('Producer', function () {
        describe('Validation', function () {
        });
        describe('CreateJob', function () {
            it('should create job and return job id', function () {
            });
        });
    });
});
