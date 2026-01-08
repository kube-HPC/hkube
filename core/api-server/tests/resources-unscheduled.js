const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
// ensure the common test setup runs when executing this file directly
require('./setup');

let restUrl;
const DatabaseQuerier = require('../api/graphql/queries/database-querier');

describe('Resources - unscheduled algorithms', () => {
    let originalGetDiscovery;
    before(() => {
        restUrl = global.testParams.restUrl;
        // stub DatabaseQuerier._getDiscoveryType for deterministic tests
        originalGetDiscovery = DatabaseQuerier._getDiscoveryType;
        DatabaseQuerier._getDiscoveryType = async (type) => {
            if (type === 'task-executor') {
                return [
                    {
                        unScheduledAlgorithms: {
                            'my-algo': { type: 'task', some: 'prop' }
                        },
                        ignoredUnScheduledAlgorithms: {
                            'ignored-algo': { type: 'task', reason: 'test' }
                        }
                    }
                ];
            }
            return [];
        };
    });

    after(() => {
        // restore original implementation
        DatabaseQuerier._getDiscoveryType = originalGetDiscovery;
    });

    describe('GET /resources/unscheduledalgorithms', () => {
        let uri;
        before(() => {
            uri = `${restUrl}/resources/unscheduledalgorithms`;
        });

        it('should return an object', async () => {
            const res = await request({ method: 'GET', uri });
            expect(res.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(res.body).to.be.an('object');
        });

        it('should contain my-algo when discovery has task-executor data', async () => {
            const listRes = await request({ method: 'GET', uri });
            expect(listRes.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(listRes.body).to.have.property('my-algo');
        });
    });

    describe('GET /resources/unscheduledalgorithms/:algorithmName', () => {
        let uri;
        before(() => {
            uri = `${restUrl}/resources/unscheduledalgorithms`;
        });

        it('should return 404 for unknown algorithm', async () => {
            const res = await request({ method: 'GET', uri: `${uri}/does-not-exist` });
            expect([HttpStatus.StatusCodes.NOT_FOUND, HttpStatus.StatusCodes.OK]).to.include(res.response.statusCode);
        });

        it('should return item with kind when algorithm exists', async () => {
            const itemRes = await request({ method: 'GET', uri: `${uri}/my-algo` });
            expect(itemRes.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(itemRes.body).to.have.property('kind');
        });
    });

    describe('GET /resources/ignoredunscheduledalgorithms', () => {
        let uri;
        before(() => {
            uri = `${restUrl}/resources/ignoredunscheduledalgorithms`;
        });

        it('should return an object', async () => {
            const res = await request({ method: 'GET', uri });
            expect(res.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(res.body).to.be.an('object');
        });

        it('should contain ignored-algo when discovery has task-executor data', async () => {
            const ignoredList = await request({ method: 'GET', uri });
            expect(ignoredList.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(ignoredList.body).to.have.property('ignored-algo');
        });
    });

    describe('GET /resources/ignoredunscheduledalgorithms/:algorithmName', () => {
        let uri;
        before(() => {
            uri = `${restUrl}/resources/ignoredunscheduledalgorithms`;
        });

        it('should return 404 for unknown algorithm', async () => {
            const res = await request({ method: 'GET', uri: `${uri}/does-not-exist` });
            expect([HttpStatus.StatusCodes.NOT_FOUND, HttpStatus.StatusCodes.OK]).to.include(res.response.statusCode);
        });

        it('should return item with kind when algorithm exists', async () => {
            const ignoredItem = await request({ method: 'GET', uri: `${uri}/ignored-algo` });
            expect(ignoredItem.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
            expect(ignoredItem.body).to.have.property('kind');
        });
    });
});
