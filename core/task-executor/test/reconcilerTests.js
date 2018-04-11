const { expect } = require('chai');
const { normalizeWorkers, normalizeRequests } = require('../lib/reconcile/reconciler');

describe('reconciler', () => {
    describe('normalize workers', () => {
        it('should work with empty worker array', () => {
            const workers = {};
            const res = normalizeWorkers(workers);
            expect(res).to.be.empty;
        });
        it('should work with undefined worker array', () => {
            const res = normalizeWorkers();
            expect(res).to.be.empty;
        });
        it('should return object with ids', () => {
            const workers = {
                '/discovery/workers/62eee6c4-6f35-4a2d-8660-fad6295ab334': {
                    algorithmName: 'green-alg',
                    workerStatus: 'ready',
                    jobStatus: 'ready',
                    error: null
                },
                '/discovery/workers/id2': {
                    algorithmName: 'green-alg',
                    workerStatus: 'not-ready',
                    jobStatus: 'ready',
                    error: null
                },
                '/discovery/workers/ae96e6ba-0352-43c4-8862-0e749d2f76c4': {
                    algorithmName: 'red-alg',
                    workerStatus: 'notready',
                    jobStatus: 'ready',
                    error: null
                }
            };
            const res = normalizeWorkers(workers);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                id: '62eee6c4-6f35-4a2d-8660-fad6295ab334',
                algorithmName: 'green-alg',
                workerStatus: 'ready',
            });
            expect(res).to.deep.include({
                id: 'id2',
                algorithmName: 'green-alg',
                workerStatus: 'not-ready',
            });
            expect(res).to.deep.include({
                id: 'ae96e6ba-0352-43c4-8862-0e749d2f76c4',
                algorithmName: 'red-alg',
                workerStatus: 'notready',
            });
        });
    });

    describe('normalize requests', () => {
        it('should work with empty requests array', () => {
            const res = normalizeRequests([]);
            expect(res).to.be.empty;
        });
        it('should work with undefined requests array', () => {
            const res = normalizeRequests();
            expect(res).to.be.empty;
        });
        it('should return object with requests per algorithms', () => {
            const stub = [
                {
                    alg: 'black-alg',
                    data: {
                        pods: 7
                    }
                },
                {
                    alg: 'green-alg',
                    data: {
                        pods: 1
                    }
                },
                {
                    alg: 'yellow-alg',
                    data: {
                        pods: 1
                    }
                }
            ];
            const res = normalizeRequests(stub);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                algorithmName: 'black-alg',
                pods: 7
            });
            expect(res).to.deep.include({
                algorithmName: 'green-alg',
                pods: 1
            });
            expect(res).to.deep.include({
                algorithmName: 'yellow-alg',
                pods: 1
            });
        });
    });
});
