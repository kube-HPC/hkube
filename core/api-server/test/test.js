
process.env.NODE_PATH = process.cwd();
require('module').Module._initPaths();

const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('request');
const bootstrap = require('../bootstrap');
let config, jobId = null;
let restUrl = 'http://localhost:3000/api/v1'

describe('Test', function () {
    before(async () => {
        const config = await bootstrap.init();

        restUrl = config.swaggerPath.path

    })
    describe('Rest-API', function () {
        describe('Execution', function () {
            describe('/exec/raw', function () {
                it('should not throw validation error', function () {
                    request({
                        method: 'POST',
                        uri: restUrl + routeSearch,
                        json: true,
                        body: {
                            'query': {
                                'geoJson': {}
                            }
                        }

                    }, (error, response, body) => {
                        expect(body).to.have.property('total');
                        expect(body).to.have.property('records');
                        done();
                    });
                });
                it('should throw validation error job.type should be string', function (done) {
                });
            });
            describe('/exec/stored', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
            describe('/exec/stop', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
            describe('/exec/status', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
            describe('/exec/results', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
        });
        describe('Store', function () {
            describe('/store/pipelines:name GET', function () {
                it('should not throw validation error', function () {
                });
                it('should throw validation error job.type should be string', function (done) {
                });
            });
            describe('/store/pipelines:name DELETE', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
            describe('/store/pipelines GET', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
            describe('/store/pipelines POST', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
            describe('/store/pipelines PUT', function () {
                it('should not throw validation error', function () {

                });
                it('should throw validation error job.type should be string', function (done) {

                });
            });
        });
    });
});
