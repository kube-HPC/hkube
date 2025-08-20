const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const { workers, jobs, pods, versions, clusterOptions, normResources, templateStore } = require('./stub');
const etcd = require('../lib/helpers/etcd');
const { stateType } = require('@hkube/consts');
const { commands } = require('../lib/consts');
const { createContainerResource } = require('../lib/reconcile/createOptions');


describe('Managers tests', () => {
    const registry = { registry: '' }
    let algorithmTemplates;
    let WorkersManager, requestsManager, jobsHandler;

    before(async () => {
        algorithmTemplates = await etcd.getAlgorithmTemplate();
        ({ WorkersManager, requestsManager, jobsHandler } = require('../lib/reconcile/managers'));
    });

    beforeEach(async () => {
        algorithmTemplates = await etcd.getAlgorithmTemplate();
    });

    describe('WorkersManager Class', () => {
        let workersManager;

        beforeEach(async () => {
            workersManager = new WorkersManager(workers, jobs, pods, algorithmTemplates, versions, registry);
        });

        describe('Constructor', () => {
            it('should build the object with relevant attributes', () => {
                algorithmTemplates['print-every-10-sec'].minHotWorkers = 1;
                workersManager = new WorkersManager(workers, jobs, pods, algorithmTemplates, versions, registry);
                expect(workersManager.normalizedWorkers).to.be.an('array');
                expect(workersManager.normalizedWorkers.length).to.be.equal(workers.length);
                expect(workersManager._workersToExit).to.be.an('array');
                expect(workersManager._workersToExit.length).to.be.equal(0);
                expect(workersManager.jobAttachedWorkers).to.be.an('array');
                expect(workersManager.jobAttachedWorkers.length).to.be.equal(6); // all the 6 workers in stub data has a job
            });
        });

        describe('countBatchWorkers Method', () => {
            it('should count batch workers', () => {
                const batchWorkers = workersManager.countBatchWorkers(algorithmTemplates);
                expectedAmount = workersManager.getIdleWorkers().length + workersManager.getActiveWorkers().length;
                expect(batchWorkers).to.equal(expectedAmount); // Suppose to have 5 active and 1 batch workers, all workers algos are batch
            });

            it('should not count non-batch workers', () => {
                algorithmTemplates['green-alg'].stateType = stateType.Stateful;
                const batchWorkers = workersManager.countBatchWorkers(algorithmTemplates);
                expectedAmount = workersManager.getIdleWorkers().length + workersManager.getActiveWorkers().length - 1;
                expect(batchWorkers).to.equal(expectedAmount);
            });
        });

        describe('WorkersManager getters', () => {
            const baseWorkers = [
                { id: 'idle', workerStatus: 'ready', workerPaused: false },
                { id: 'active', workerStatus: 'working', workerPaused: false },
                { id: 'paused', workerStatus: 'ready', workerPaused: true },
                { id: 'bootstrap', workerStatus: 'bootstrap' }
            ];

            beforeEach(() => {
                workersManager.jobAttachedWorkers = baseWorkers;
            });

            describe('getIdleWorkers Method', () => {
                it('should return all workers that are idle', () => {
                    const result = workersManager.getIdleWorkers();
                    expect(result).to.deep.equal(baseWorkers.filter(worker => worker.id === 'idle'));
                    expect(result).to.not.equal(workersManager.jobAttachedWorkers.filter(w => workersManager._isIdleWorker(w))); // deep cloned
                });
            });

            describe('getActiveWorkers Method', () => {
                it('should return all workers that are active', () => {
                    const result = workersManager.getActiveWorkers();
                    expect(result).to.deep.equal(baseWorkers.filter(worker => worker.id === 'active'));
                    expect(result).to.not.equal(workersManager.jobAttachedWorkers.filter(w => workersManager._isActiveWorker(w))); // deep cloned
                });
            });

            describe('getPausedWorkers Method', () => {
                it('should return all workers that are paused', () => {
                    const result = workersManager.getPausedWorkers();
                    expect(result).to.deep.equal(baseWorkers.filter(worker => worker.id === 'paused'));
                    expect(result).to.not.equal(workersManager.jobAttachedWorkers.filter(w => workersManager._isPausedWorker(w))); // deep cloned
                });
            });

            describe('getBootstrappingWorkers Method', () => {
                it('should return all workers in bootstrap state', () => {
                    const result = workersManager.getBootstrappingWorkers();
                    expect(result).to.deep.equal(baseWorkers.filter(worker => worker.id === 'bootstrap'));
                    expect(result).to.not.equal(workersManager.jobAttachedWorkers.filter(worker => worker.workerStatus === 'bootstrap')); // deep cloned
                });
            });
        });

        describe('Worker lifecycle handlers', () => {
            const fakeWorkers = [
                { id: 'w1', algorithmName: 'alg1', podName: 'pod1', message: 'exit now' },
                { id: 'w2', algorithmName: 'alg2', podName: 'pod2' }
            ];

            describe('handleExitWorkers', () => {
                it('should return a list of exit command promises for each worker in _workersToExit', () => {
                    workersManager._workersToExit = fakeWorkers;
                    const result =  workersManager.handleExitWorkers();

                    expect(result).to.be.an('array').with.lengthOf(2);
                    result.forEach((promise) => {
                        expect(promise).to.have.property('then').that.is.a('function'); // confirms it's a Promise
                    });
                });
            });

            describe('handleWarmUpWorkers', () => {
                it('should return a list of warm-up command promises for hot workers', () => {
                    const coldWorker = workersManager.jobAttachedWorkers.find(worker => !worker.hotWorker);
                    expect(coldWorker, 'All workers in workersRaw are hot, should have at least one cold').to.not.be.undefined;
                    algorithmTemplates[coldWorker.algorithmName].minHotWorkers = 1;
                    const result =  workersManager.handleWarmUpWorkers();

                    expect(result).to.be.an('array').with.lengthOf(1);
                    result.forEach((promise) => {
                        expect(promise).to.have.property('then').that.is.a('function'); // confirms it's a Promise
                    });
                });
            });

            describe('handleCoolDownWorkers', () => {
                it('should return a list of cool-down command promises for cold workers', () => {
                    const result =  workersManager.handleCoolDownWorkers(); // we have in stub workers 4 hot workers that should be cold

                    expect(result).to.be.an('array').with.lengthOf(4);
                    result.forEach((promise) => {
                        expect(promise).to.have.property('then').that.is.a('function'); // confirms it's a Promise
                    });
                });
            });

            describe('stop', () => {
                it('should return a list of stop-processing command promises for each worker', () => {
                    const result = workersManager.stop(fakeWorkers);

                    expect(result).to.be.an('array').with.lengthOf(fakeWorkers.length);
                    result.forEach(promise => {
                        expect(promise).to.have.property('then').that.is.a('function'); // ensures it's a Promise
                    });
                });
            });

            describe('resume', () => {
                it('should return a list of start-processing command promises for each worker', () => {
                    const result = workersManager.resume(fakeWorkers);

                    expect(result).to.be.an('array').with.lengthOf(fakeWorkers.length);
                    result.forEach(promise => {
                        expect(promise).to.have.property('then').that.is.a('function'); // ensures it's a Promise
                    });
                });
            });
        });
    });

    describe('RequestsManager Class', () => {
        let workersManager;
        let allAllocatedJobs;
        const batchRequest = { algorithmName: 'algo-batch', requestType: 'batch' };
        const statefulRequest = { algorithmName: 'algo-stateful', requestType: stateType.Stateful };
        const statelessRequest = { algorithmName: 'algo-stateless', requestType: stateType.Stateless };
        const algo1Request = { algorithmName: 'algo1', requestType: 'batch' };
        const algo2Request = { algorithmName: 'algo2', requestType: 'batch' };

        before(async () => {
            workersManager = new WorkersManager(workers, jobs, pods, algorithmTemplates, versions, registry);
            const { jobsPendingForWorkers } = workersManager;
            const idleWorkers = workersManager.getIdleWorkers();
            const activeWorkers = workersManager.getActiveWorkers();
            const pausedWorkers = workersManager.getPausedWorkers();
            const bootstrappingWorkers = workersManager.getBootstrappingWorkers();
            allAllocatedJobs = {
                idleWorkers, activeWorkers, pausedWorkers, bootstrappingWorkers, jobsPendingForWorkers
            };
        });

        beforeEach(async () => {
            requestsManager._totalCapacityNow = 10; // Default/init state
        });

        describe('prepareAlgorithmRequests Method', () => {
            // Not too much to test here, since all it's pipeline methods are being tested below.

            it('should process a minimal request list without errors', () => {
                const requests = [ { data: [ { name: 'alg1' } ] } ];
                const templates = { alg1: {} };
                const result = requestsManager.prepareAlgorithmRequests(requests, templates, [], {
                    idleWorkers: [], activeWorkers: [], pausedWorkers: [], jobsPendingForWorkers: []
                });

                expect(result).to.be.an('array');
                expect(result.length).to.be.greaterThan(0);
            });

            it('should return an array of properly structured requests', () => {
                const requests = [ { data: [ { name: 'stateful-alg' }, { name: 'batch-alg' } ] } ];
                const templates = { 'stateful-alg': { stateType: stateType.Stateful }, 'batch-alg': {} };

                const result = requestsManager.prepareAlgorithmRequests(requests, templates, [], {
                    idleWorkers: [], activeWorkers: [], pausedWorkers: [], jobsPendingForWorkers: []
                });

                expect(result).to.be.an('array');
                expect(result.length).to.be.greaterThan(0);
                result.forEach(req => {
                    expect(req).to.have.property('algorithmName');
                    expect(req).to.have.property('requestType');
                });
            });

            it('should filter out requests when maxWorkers limit is reached', () => {
                const requests = [ { data: [ { name: 'limited-alg' }, { name: 'limited-alg' } ] } ];
                const templates = { 'limited-alg': { maxWorkers: 1 } };
                const jobWorkers = [
                    { algorithmName: 'limited-alg' } // already using 1 worker
                ];

                const result = requestsManager.prepareAlgorithmRequests(requests, templates, jobWorkers, {
                    idleWorkers: [], activeWorkers: [], pausedWorkers: [], jobsPendingForWorkers: []
                });

                expect(result.length).to.equal(0);
            });

            it('should move quota-required requests to the front', () => {
                const requests = [ { data: [ { name: 'other' }, { name: 'guaranteed' } ] } ];
                const templates = {
                    'guaranteed': { quotaGuarantee: 1 },
                    'other': {}
                };

                const result = requestsManager.prepareAlgorithmRequests(requests, templates, [], {
                    idleWorkers: [], activeWorkers: [], pausedWorkers: [], jobsPendingForWorkers: []
                });

                expect(result[0].algorithmName).to.equal('guaranteed');
            });

            it('should return an empty array when input is empty', () => {
                const result = requestsManager.prepareAlgorithmRequests([], {}, [], {
                    idleWorkers: [], activeWorkers: [], pausedWorkers: [], jobsPendingForWorkers: []
                });
                expect(result).to.deep.equal([]);
            });

        });

        describe('updateCapacity Method', () => {
            it('should not pass 50 capacity', () => {
                requestsManager.updateCapacity(666666);
                expect(requestsManager._totalCapacityNow).to.be.equal(50);
            });

            it('should not go lower than 2 capacity', () => {
                requestsManager.updateCapacity(-666666);
                expect(requestsManager._totalCapacityNow).to.be.equal(2);
            });
        });

        describe('_filterByMaxWorkers Method', () => {
            let jobAttachedWorkers;

            before(() => {
                ({ jobAttachedWorkers } = workersManager);
            });

            it('should return empty list when no reqeusts', () => {
                const result = requestsManager._filterByMaxWorkers(algorithmTemplates, [], []);
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(0);
            });

            it('should filter requests with maxWorkers', () => {
                const algo = { name: 'max-workers', maxWorkers: 1 };
                const request = { algorithmName: 'max-workers', requestType: 'batch' }
                const normRequests = [ request, request ];
                algorithmTemplates[algo.name] = algo;

                const result = requestsManager._filterByMaxWorkers(algorithmTemplates, normRequests, []);
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(1);
            });

            it('should not filter requests of algorithms with maxWorkers if enough available', () => {
                const algo = { name: 'max-workers', maxWorkers: 2 };
                const request = { algorithmName: 'max-workers', requestType: 'batch' }
                const normRequests = [ request, request ];
                algorithmTemplates[algo.name] = algo;

                const result = requestsManager._filterByMaxWorkers(algorithmTemplates, normRequests, []);
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(2);
            });

            it('should filter all requests of algorithms when there are enough workers already up and running', () => {
                const { algorithmName } = jobAttachedWorkers[0]; // doesn't matter which one
                const workersCount = jobAttachedWorkers.filter(worker => worker.algorithmName === algorithmName).length;
                const maxWorkers = 1;
                algorithmTemplates[algorithmName].maxWorkers = maxWorkers;
                const request = { algorithmName, requestType: 'batch' };
                const normRequests = [ request, request ];

                const result = requestsManager._filterByMaxWorkers(algorithmTemplates, normRequests, jobAttachedWorkers);
                const expectedAmount = maxWorkers - workersCount > 0 ? maxWorkers - workersCount : 0;
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(expectedAmount);
            });

            it('should filter some requests of algorithms with maxWorkers enough to request missing workers', () => {
                const { algorithmName } = jobAttachedWorkers[0]; // doesn't matter which one
                const workersCount = jobAttachedWorkers.filter(worker => worker.algorithmName === algorithmName).length;
                const maxWorkers = 3;
                algorithmTemplates[algorithmName].maxWorkers = maxWorkers;
                const request = { algorithmName, requestType: 'batch' };
                const normRequests = [ request, request, request, request, request, request ];

                const result = requestsManager._filterByMaxWorkers(algorithmTemplates, normRequests, jobAttachedWorkers);
                const expectedAmount = maxWorkers - workersCount > 0 ? maxWorkers - workersCount : 0;
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(expectedAmount);
            });
        });

        describe('QuotaGuarantee logic tests', () => {
            const categorizedRequests = {
                batchRequests: [batchRequest, batchRequest],
                streamingRequests: [statefulRequest, statefulRequest, statelessRequest, statelessRequest]
            };
            const greenRequest = { algorithmName: 'green-alg', requestType: 'batch' };
            const blackRequest = { algorithmName: 'black-alg', requestType: 'batch' };

            describe('_prioritizeQuotaRequisite Method', () => {
                const { batchRequests } = categorizedRequests;
                it('should return the same requests as input when there is no algorithms with quotaGuarantee', () => {
                    const result = requestsManager._prioritizeQuotaRequisite(batchRequests, algorithmTemplates, allAllocatedJobs);
                    expect(result).to.be.an('array');
                    expect(result).to.be.deep.equal(categorizedRequests.batchRequests);
                });

                it('should return prioritized requests based on algorithms with quotaGuarantee', () => {
                    const algorithmName = 'green-alg';
                    const existingWorkers = Object.values(allAllocatedJobs).reduce((acc, workersCategory) => {
                        return acc + workersCategory.reduce((acc, worker) => {
                            return acc + (worker.algorithmName === algorithmName ? 1 : 0);
                        }, 0);
                    }, 0);
                    algorithmTemplates[algorithmName].quotaGuarantee = existingWorkers + 1;
                    const normRequests = [...batchRequests];
                    normRequests.push(greenRequest);

                    expect(normRequests[0].algorithmName).to.not.equal(algorithmName);
                    const result = requestsManager._prioritizeQuotaRequisite(normRequests, algorithmTemplates, allAllocatedJobs);
                    expect(result).to.be.an('array');
                    expect(result[0].algorithmName).to.equal(algorithmName);
                    expect(result[0].isRequisite).to.be.true;
                });

                describe('_createRequisitesRequests Method', () => {
                    const getExisitingWorkersAmount = (algorithmName) => {
                        return Object.values(allAllocatedJobs).reduce((acc, workersCategory) => {
                            return acc + workersCategory.reduce((acc, worker) => {
                                return acc + (worker.algorithmName === algorithmName ? 1 : 0);
                            }, 0);
                        }, 0);
                    };

                    it('should return all requests as they are and no requisite if no requisite algorithm exist', () => {
                        const { requests, requisites } = requestsManager._createRequisitesRequests(batchRequests, algorithmTemplates, allAllocatedJobs);
                        expect(requests).to.be.an('array');
                        expect(requests).to.be.deep.equal(categorizedRequests.batchRequests);
                        expect(requisites).to.be.an('object');
                        expect(requisites.totalRequired).to.equal(0);
                    });

                    it('should create requisite requests when there are no workers as well', () => {
                        const algorithmName = 'green-alg';
                        algorithmTemplates[algorithmName].quotaGuarantee = 1;
                        const normRequests = [...batchRequests];
                        normRequests.push(greenRequest);
                        const allAllocatedJobsStub = { idleWorkers: [], activeWorkers: [], pausedWorkers: [], bootstrappingWorkers: [], jobsPendingForWorkers: [] };

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, allAllocatedJobsStub);
                        expect(requests).to.be.an('array');
                        expect(requests.filter(request => request.algorithmName === algorithmName)).to.be.empty;
                        expect(requisites).to.be.an('object');
                        expect(requisites.totalRequired).to.equal(1);
                        expect(requisites.algorithms[algorithmName].required.length).to.equal(1);
                        expect(requisites.algorithms[algorithmName].required[0]).to.deep.equal(normRequests[normRequests.length - 1]);
                    });

                    it('should create requisites requests based on prioritized requests', () => {
                        const algorithmName = 'green-alg'; // there is a worker for green-alg
                        const existingWorkers = getExisitingWorkersAmount(algorithmName);
                        algorithmTemplates[algorithmName].quotaGuarantee = existingWorkers + 1;
                        const normRequests = [...batchRequests];
                        normRequests.push(greenRequest);

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, allAllocatedJobs);
                        expect(existingWorkers).to.be.greaterThan(0, 'The raw worker stub was edited (green-alg)!');
                        expect(requests).to.be.an('array');
                        expect(requests.filter(request => request.algorithmName === algorithmName)).to.be.empty;
                        expect(requisites).to.be.an('object');
                        expect(requisites.totalRequired).to.equal(1);
                        expect(requisites.algorithms[algorithmName].required.length).to.equal(1);
                        expect(requisites.algorithms[algorithmName].required[0]).to.deep.equal(normRequests[normRequests.length - 1]);
                    });

                    it('should not create requisites requests if there are enough workers', () => {
                        const algorithmName = 'green-alg';
                        const existingWorkers = getExisitingWorkersAmount(algorithmName);
                        algorithmTemplates[algorithmName].quotaGuarantee = existingWorkers;
                        const normRequests = [...batchRequests];
                        normRequests.push(greenRequest);

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, allAllocatedJobs);
                        expect(existingWorkers).to.be.above(0, 'The raw worker stub was edited (green-alg)!');
                        expect(requests).to.be.an('array');
                        expect(requests.filter(request => request.algorithmName === algorithmName).length).to.be.equal(1);
                        expect(requisites).to.be.an('object');
                        expect(requisites.totalRequired).to.equal(0);
                        expect(requisites.algorithms).to.be.empty;
                    });

                    it('should handle correctly when more than 1 algorithm has requisite', () => {
                        const algorithmName1 = 'green-alg';
                        const algorithmName2 = 'black-alg';
                        const existingWorkers1 = getExisitingWorkersAmount(algorithmName1);
                        const existingWorkers2 = getExisitingWorkersAmount(algorithmName2);
                        algorithmTemplates[algorithmName1].quotaGuarantee = existingWorkers1 + 2;
                        algorithmTemplates[algorithmName2].quotaGuarantee = existingWorkers2 + 1;
                        const normRequests = [...batchRequests];
                        normRequests.push(greenRequest);
                        normRequests.push(greenRequest);
                        normRequests.push(greenRequest);
                        normRequests.push(blackRequest);
                        normRequests.push(blackRequest);
                        normRequests.push(blackRequest);

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, allAllocatedJobs);
                        expect(existingWorkers1).to.be.above(0, 'The raw worker stub was edited (green-alg)!');
                        expect(existingWorkers2).to.be.above(0, 'The raw worker stub was edited (black-alg)!');
                        expect(requests).to.be.an('array');
                        expect(requests.filter(request => request.algorithmName === algorithmName1).length).to.be.equal(1);
                        expect(requests.filter(request => request.algorithmName === algorithmName2).length).to.be.equal(2);
                        expect(requests.filter(request => (request.algorithmName !== algorithmName1 && request.algorithmName !== algorithmName2)).length).to.be.equal(batchRequests.length);
                        expect(requisites).to.be.an('object');
                        expect(requisites.totalRequired).to.equal(3);
                        expect(requisites.algorithms[algorithmName1].required[0]).to.deep.equal({ algorithmName: algorithmName1, requestType: 'batch' });
                        expect(requisites.algorithms[algorithmName2].required[0]).to.deep.equal({ algorithmName: algorithmName2, requestType: 'batch' });
                    });
                });

                describe('_mergeRequisiteRequests Method', () => {
                    const requests = [batchRequest, batchRequest, greenRequest, blackRequest, blackRequest];

                    it('should merge the requisite requests correctly when the requisites order is first lower requisite algo and then higher requisite algo', () => {
                        const requisiteRequestsAmount = 3;
                        const requisites =  {
                            totalRequired: requisiteRequestsAmount,
                            algorithms: {
                                'black-alg': { required: [blackRequest] }, // lower than green-alg
                                'green-alg': { required: [greenRequest, greenRequest] }
                            }
                        };
                        const mergedRequests = requestsManager._mergeRequisiteRequests(requests, requisites);
                        expect(mergedRequests).to.be.an('array');
                        expect(mergedRequests.length).to.equal(requests.length + requisiteRequestsAmount);
                        expect(mergedRequests).to.deep.include.members(Object.values(requisites.algorithms).flatMap(a => a.required));
                        expect(mergedRequests.filter(request => request.algorithmName === 'black-alg').length).to.equal(3);
                        expect(mergedRequests.filter(request => request.algorithmName === 'green-alg').length).to.equal(3);
                        expect(mergedRequests.filter(request => request.algorithmName!== 'black-alg' && request.algorithmName!== 'green-alg').length).to.equal(2);
                        expect(mergedRequests.filter(request => request.requestType === 'batch').length).to.equal(8);
                    });

                    it('should merge the requisite requests correctly when the requisites order is first higher requisite algo and then lower requisite algo', () => {
                        const requisiteRequestsAmount = 3;
                        const requisites =  {
                            totalRequired: requisiteRequestsAmount,
                            algorithms: {
                                'green-alg': { required: [greenRequest, greenRequest] }, // higher than black-alg
                                'black-alg': { required: [blackRequest] },
                            }
                        };
                        const mergedRequests = requestsManager._mergeRequisiteRequests(requests, requisites);
                        expect(mergedRequests).to.be.an('array');
                        expect(mergedRequests.length).to.equal(requests.length + requisiteRequestsAmount);
                        expect(mergedRequests).to.deep.include.members(Object.values(requisites.algorithms).flatMap(a => a.required));
                        expect(mergedRequests.filter(request => request.algorithmName === 'black-alg').length).to.equal(3);
                        expect(mergedRequests.filter(request => request.algorithmName === 'green-alg').length).to.equal(3);
                        expect(mergedRequests.filter(request => request.algorithmName!== 'black-alg' && request.algorithmName!== 'green-alg').length).to.equal(2);
                        expect(mergedRequests.filter(request => request.requestType === 'batch').length).to.equal(8);
                    });

                    it('should place requisite requests in the start of the requests list', () => {
                        const requisiteRequestsAmount = 3;
                        const requisites =  {
                            totalRequired: requisiteRequestsAmount,
                            algorithms: {
                                'black-alg': { required: [blackRequest] },
                                'green-alg': { required: [greenRequest, greenRequest] }
                            }
                        };
                        const mergedRequests = requestsManager._mergeRequisiteRequests(requests, requisites);
                        mergedRequests.forEach((request, index) => {
                            if (index < requisiteRequestsAmount) {
                                expect(request.isRequisite).to.be.true;
                                expect(request.algorithmName).to.be.oneOf(['black-alg', 'green-alg']);
                            }
                            else {
                                expect(request.isRequisite).to.be.undefined;
                            }
                        });
                    });

                    it('should return the same request list untouched when requisites is empty', () => {
                        const mergedRequests = requestsManager._mergeRequisiteRequests(requests, {});
                        expect(mergedRequests).to.be.an('array');
                        expect(mergedRequests).to.deep.equal(requests);
                    });
                });
            });
        });

        describe('_workersToMap Method', () => {
            let runningWorkersList;

            before(() => {
                runningWorkersList = Object.values(allAllocatedJobs).flat();
            });

            it('should correctly count workers grouped by their algorithmName', () => {
                const workersMap = requestsManager._workersToMap(runningWorkersList);
                expect(workersMap).to.be.an('object');
                Object.entries(workersMap).forEach(([algName, count]) => {
                    const workersCount = runningWorkersList.filter(worker => worker.algorithmName === algName).length;
                    expect(count).to.equal(workersCount);
                });
            });

            it('should handle an empty workers array', () => {
                const workersMap = requestsManager._workersToMap([]);
                expect(workersMap).to.be.an('object');
                expect(Object.keys(workersMap)).to.be.empty;
            });
        });

        describe('_splitRequestsByType Method', () => {
            const shuffleArray = (array) => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(0.5 * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };
            const buildRequests = (batchAmount, statefulAmount, statelessAmount, shouldShuffle = true) => {
                const batchRequests = Array(batchAmount).fill(batchRequest);
                const statefulRequests = Array(statefulAmount).fill(statefulRequest);
                const statelessRequests = Array(statelessAmount).fill(statelessRequest);
                const allRequests =  [...batchRequests,...statefulRequests,...statelessRequests];
                return shouldShuffle ? shuffleArray(allRequests) : allRequests;
            };
            const checkResult = (result, expectedBatch, expectedStreaming) => {
                expect(result).to.be.an('object');
                expect(result.batchRequests).to.be.an('array');
                expect(result.batchRequests.length).to.be.equal(expectedBatch);
                expect(result.streamingRequests).to.be.an('array');
                expect(result.streamingRequests.length).to.be.equal(expectedStreaming);
            };

            it('should split correctly when getting stateful, stateless and batch requests', () => {
                const requests = buildRequests(2, 2, 2);
                const result = requestsManager._splitRequestsByType(requests);
                checkResult(result, 2, 4);
            });

            it('should work with only batch request types', () => {
                const requests = buildRequests(6, 0, 0);
                const result = requestsManager._splitRequestsByType(requests);
                checkResult(result, 6, 0);
            });

            it('should work with only streaming request types', () => {
                const requests = buildRequests(0, 3, 3);
                const result = requestsManager._splitRequestsByType(requests);
                checkResult(result, 0, 6);
            });

            it('should order stateful requests before stateless requests', () => {
                const statefulCount = 3;
                const requests = buildRequests(0, statefulCount, 3);
                const { streamingRequests } = requestsManager._splitRequestsByType(requests);
                streamingRequests.forEach((request, index) => {
                    if (index < statefulCount) {
                        expect(request.requestType).to.equal(stateType.Stateful);
                    }
                    else {
                        expect(request.requestType).to.equal(stateType.Stateless);
                    }
                });
            });

            it('should handle empty input', () => {
                const result = requestsManager._splitRequestsByType([]);
                checkResult(result, 0, 0);
            })
        });

        describe('_splitAlgorithmsByType Method', () => {
            it('should return empty objects when input is empty', () => {
                const result = requestsManager._splitAlgorithmsByType({});
                expect(result).to.deep.equal({ batchTemplates: {}, streamingTemplates: {} });
            });

            it('should categorize batch templates without stateType', () => {
                const templates = {
                    alg1: { name: 'alg1' },
                    alg2: { name: 'alg2', stateType: undefined },
                    alg3: { name: 'alg3', stateType: null }
                };

                const result = requestsManager._splitAlgorithmsByType(templates);
                expect(Object.keys(result.batchTemplates)).to.have.members(['alg1', 'alg2', 'alg3']);
                expect(result.streamingTemplates).to.deep.equal({});
            });

            it('should categorize streaming templates with stateful or stateless', () => {
                const templates = {
                    statefulAlg: { name: 'statefulAlg', stateType: stateType.Stateful },
                    statelessAlg: { name: 'statelessAlg', stateType: stateType.Stateless }
                };

                const result = requestsManager._splitAlgorithmsByType(templates);
                expect(Object.keys(result.streamingTemplates)).to.have.members(['statefulAlg', 'statelessAlg']);
                expect(result.batchTemplates).to.deep.equal({});
            });

            it('should categorize mixed batch and streaming correctly', () => {
                const templates = {
                    batch1: { name: 'batch1' },
                    stream1: { name: 'stream1', stateType: stateType.Stateful },
                    stream2: { name: 'stream2', stateType: stateType.Stateless },
                    batch2: { name: 'batch2' }
                };

                const result = requestsManager._splitAlgorithmsByType(templates);
                expect(Object.keys(result.batchTemplates)).to.have.members(['batch1', 'batch2']);
                expect(Object.keys(result.streamingTemplates)).to.have.members(['stream1', 'stream2']);
            });

            it('should ignore templates with non-streaming unknown stateType', () => {
                const templates = {
                    batch1: { name: 'batch1' },
                    unknown: { name: 'unknown', stateType: 'window' } // Not in [Stateful, Stateless]
                };

                const result = requestsManager._splitAlgorithmsByType(templates);
                expect(Object.keys(result.batchTemplates)).to.have.members(['batch1']);
                expect(Object.keys(result.streamingTemplates)).to.not.include('unknown');
            });
        });

        describe('_handleBatchRequests Method', () => {
            it('should return batch requests array', () => {
                const requests = [
                    { algorithmName: 'batch-algo', requestType: 'batch' }
                ];
                const batchTemplates = {
                    'batch-algo': { algorithmName: 'batch-algo' }
                };

                const result = requestsManager._handleBatchRequests(requests, batchTemplates);
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(1);
            });

            it('should return empty array if no empty lists are given', () => {
                const result = requestsManager._handleBatchRequests([], {});
                expect(result).to.be.an('array').that.is.empty;
            });
        });

        describe('_createBatchWindow Method', () => {
            // Reminder - _totalCapacityNow is being reset back to 10 every test (in the beforeEach)
            it('should return all batch requests if the window size is large enough', () => {
                const requestCount = 30;
                const factor = 3;
                expect(requestsManager._totalCapacityNow * factor).to.be.gte(requestCount, '_totalCapacityNow was changed!');
                const requests = new Array(requestCount).fill(batchRequest);
                const batchWindow = requestsManager._createBatchWindow(requests);
                expect(batchWindow).to.be.an('array');
                expect(batchWindow).to.deep.equal(requests);
            });

            it('should return a subset of batch requests based on the window size factor', () => {
                const requestCount = 31;
                const factor = 3;
                expect(requestsManager._totalCapacityNow * factor).to.be.lte(requestCount, '_totalCapacityNow was changed!');
                const requests = new Array(requestCount).fill(batchRequest);
                const batchWindow = requestsManager._createBatchWindow(requests);
                expect(batchWindow).to.be.an('array');
                expect(batchWindow.length).to.be.lt(requestCount);
            });

            it('should return empty array when there are no requests', () => {
                const batchWindow = requestsManager._createBatchWindow([]);
                expect(batchWindow).to.be.an('array');
                expect(batchWindow).to.be.empty;
            });
        });

        describe('_limitRequestsByCapacity Method', () => {
            // Explanation: result=count/Total → result * totalCapacityNow (≈ round up)

            it('should return all requests if capacity is high enough', () => {
                requestsManager._totalCapacityNow = 10;

                const requests = [ algo1Request, algo2Request, algo1Request, algo2Request ];

                const result = requestsManager._limitRequestsByCapacity(requests);
                expect(result).to.have.lengthOf(4);
                expect(result).to.deep.equal(requests);
            });

            it('should limit requests proportionally by algorithm ratio', () => {
                requestsManager._totalCapacityNow = 3;
                const requests = [ ...Array(4).fill(algo1Request), algo2Request, batchRequest ];

                // Total:       6
                // algo1:       4/6 = 0.666.. → 0.666.. * 3 = 2 (≈ 2 allowed)
                // algo2:       1/6 = 0.166.. → 0.166.. * 3 = 0.5 (≈ 1 allowed)
                // batch-algo:  1/6 = 0.166.. → 0.166.. * 3 = 0.5 (≈ 1 allowed)

                const result = requestsManager._limitRequestsByCapacity(requests);

                const counts = result.reduce((acc, r) => {
                    acc[r.algorithmName] = (acc[r.algorithmName] || 0) + 1;
                    return acc;
                }, {});

                expect(result.length).to.be.at.most(4);
                expect(counts[algo1Request.algorithmName]).to.be.at.most(2);
                expect(counts[algo2Request.algorithmName]).to.be.equal(1);
                expect(counts[batchRequest.algorithmName]).to.be.equal(1);
            });

            it('should not include more requests than allowed per algorithm', () => {
                requestsManager._totalCapacityNow = 2;

                const requests = [ algo1Request, algo1Request, algo1Request, algo2Request ];

                // Total: 4
                // a: 3/4 = 0.75 → 0.75 * 2 = 1.5 (≈ 2 allowed)
                // b: 1/4 = 0.25 → 0.25 * 2 = 0.5 (≈ 1 allowed)

                const result = requestsManager._limitRequestsByCapacity(requests);

                const countA = result.filter(r => r.algorithmName === algo1Request.algorithmName).length;
                const countB = result.filter(r => r.algorithmName === algo2Request.algorithmName).length;

                expect(result.length).to.be.at.most(3);
                expect(countA).to.be.at.most(2);
                expect(countB).to.be.at.most(1);
            });

            it('should return an empty array if given no requests', () => {
                requestsManager._totalCapacityNow = 5;
                const result = requestsManager._limitRequestsByCapacity([]);
                expect(result).to.deep.equal([]);
            });

            it('should handle single algorithm with multiple requests and limited capacity', () => {
                requestsManager._totalCapacityNow = 1;

                const requests = [ algo1Request, algo1Request, algo1Request ];

                const result = requestsManager._limitRequestsByCapacity(requests);

                expect(result.length).to.equal(1);
                expect(result[0].algorithmName).to.equal(algo1Request.algorithmName);
            });

            it('should distribute fairly across multiple algorithms when possible', () => {
                requestsManager._totalCapacityNow = 6;

                const requests = [ algo1Request, algo1Request, algo1Request, algo2Request, algo2Request, batchRequest ];

                // Total: 6
                // a: 0.5 → 3
                // b: 0.33 → 2
                // c: 0.17 → 1

                const result = requestsManager._limitRequestsByCapacity(requests);

                const counts = result.reduce((acc, r) => {
                    acc[r.algorithmName] = (acc[r.algorithmName] || 0) + 1;
                    return acc;
                }, {});

                expect(result.length).to.equal(6);
                expect(counts[algo1Request.algorithmName]).to.equal(3);
                expect(counts[algo2Request.algorithmName]).to.equal(2);
                expect(counts[batchRequest.algorithmName]).to.equal(1);
            });
        });

        describe('_calculateRequestRatios Method', () => {
            it('should return zero total and empty algorithm stats when there are no requests', () => {
                const result = requestsManager._calculateRequestRatios([], 10);
                expect(result.total).to.equal(0);
                expect(result.algorithms).to.deep.equal({});
            });

            it('should return total 1 and one algorithm count when there is only one request', () => {
                const requests = [ algo1Request ];
                const result = requestsManager._calculateRequestRatios(requests);
                expect(result.total).to.equal(1);
                expect(result.algorithms[algo1Request.algorithmName].count).to.equal(1);
            });

            it('should correctly calculate counts for a single algorithm with multiple requests', () => {
                const requests = [ algo1Request, algo1Request ];
                const result = requestsManager._calculateRequestRatios(requests);
                expect(result.total).to.equal(2);
                expect(result.algorithms[algo1Request.algorithmName].count).to.equal(2);
            });

            it('should correctly calculate counts and list for multiple different algorithms', () => {
                const requests = [ algo1Request, algo2Request, algo1Request ];
                const result = requestsManager._calculateRequestRatios(requests);
                expect(result.total).to.equal(3);
                expect(result.algorithms[algo1Request.algorithmName].count).to.equal(2);
                expect(result.algorithms[algo2Request.algorithmName].count).to.equal(1);
            });

            it('should calculate ratios and required capacity when capacity is provided', () => {
                const requests = [ algo1Request, algo1Request, algo2Request ];
                const capacity = 10;
                const result = requestsManager._calculateRequestRatios(requests, capacity);
                expect(result.algorithms[algo1Request.algorithmName].ratio).to.equal(2 / 3);
                expect(result.algorithms[algo1Request.algorithmName].required).to.equal(10 * (2 / 3));
                expect(result.algorithms[algo2Request.algorithmName].ratio).to.equal(1 / 3);
                expect(result.algorithms[algo2Request.algorithmName].required).to.equal(10 * (1 / 3));
            });

            it('should not exceed total requests when capacity is larger than total number of requests', () => {
                const requests = [ algo1Request, algo2Request ];
                const capacity = 100;
                const result = requestsManager._calculateRequestRatios(requests, capacity);
                expect(result.algorithms[algo1Request.algorithmName].required).to.equal(50); // 100 * (1/2)
                expect(result.algorithms[algo2Request.algorithmName].required).to.equal(50); // 100 * (1/2)
            });
        });

        describe('_handleStreamingRequests Method', () => {
            it('should return streaming requests array', () => {
                const requests = [
                    { algorithmName: 'stream-algo', requestType: stateType.Stateful }
                ];
                const streamingTemplates = {
                    'stream-algo': { algorithmName: 'stream-algo' }
                };

                const result = requestsManager._handleStreamingRequests(requests, streamingTemplates);
                expect(result).to.be.an('array');
                expect(result.length).to.be.equal(1);
            });

            it('should return empty array if no empty lists are given', () => {
                const result = requestsManager._handleStreamingRequests([], {});
                expect(result).to.be.an('array').that.is.empty;
            });
        });

        describe('_merge Method', () => {
            it('should return an empty array when both inputs are empty', () => {
                const result = requestsManager._merge([], []);
                expect(result).to.deep.equal([]);
            });

            it('should return all requisites with streaming before batch', () => {
                const batch = [ { algorithmName: 'batch1', requestType: 'batch', isRequisite: true } ];
                const streaming = [
                    { algorithmName: 'stream1', requestType: stateType.Stateful, stateType: stateType.Stateful, isRequisite: true },
                    { algorithmName: 'stream2', requestType: stateType.Stateless, stateType: stateType.Stateless, isRequisite: true }
                ];

                const result = requestsManager._merge(batch, streaming);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['stream1', 'stream2', 'batch1']);
            });

            it('should return requisites followed by stateful and stateless streaming, then batch', () => {
                const batch = [
                    { algorithmName: 'batch1', requestType: 'batch' },
                    { algorithmName: 'batch2', requestType: 'batch', isRequisite: true }
                ];
                const streaming = [
                    { algorithmName: 'stream1', requestType: stateType.Stateful, stateType: stateType.Stateful, isRequisite: true },
                    { algorithmName: 'stream2', requestType: stateType.Stateful, stateType: stateType.Stateful },
                    { algorithmName: 'stream3', requestType: stateType.Stateless, stateType: stateType.Stateless }
                ];

                const result = requestsManager._merge(batch, streaming);
                expect(result.map(r => r.algorithmName)).to.deep.equal([
                    'stream1', // requisite (streaming)
                    'batch2',  // requisite (batch)
                    'stream2', // stateful
                    'stream3', // stateless
                    'batch1'   // normal batch
                ]);
            });

            it('should order non-requisite streaming by stateful before stateless', () => {
                const streaming = [
                    { algorithmName: 's1', requestType: stateType.Stateless, stateType: stateType.Stateless },
                    { algorithmName: 's2', requestType: stateType.Stateful, stateType: stateType.Stateful },
                    { algorithmName: 's3', requestType: stateType.Stateless, stateType: stateType.Stateless },
                    { algorithmName: 's4', requestType: stateType.Stateful, stateType: stateType.Stateful }
                ];

                const result = requestsManager._merge([], streaming);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['s2', 's4', 's1', 's3']);
            });

            it('should place all non-requisite batch requests last', () => {
                const batch = [
                    { algorithmName: 'b1', requestType: 'batch' },
                    { algorithmName: 'b2', requestType: 'batch' }
                ];

                const result = requestsManager._merge(batch, []);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['b1', 'b2']);
            });

            it('should not include requisites more than once', () => {
                const streaming = [
                    { algorithmName: 's1', requestType: stateType.Stateful, stateType: stateType.Stateful, isRequisite: true },
                    { algorithmName: 's2', requestType: stateType.Stateful, stateType: stateType.Stateful }
                ];
                const batch = [
                    { algorithmName: 'b1', requestType: 'batch', isRequisite: true },
                    { algorithmName: 'b2', requestType: 'batch' }
                ];

                const result = requestsManager._merge(batch, streaming);

                // Ensure s1 and b1 appear only once, despite also being requisites
                const names = result.map(r => r.algorithmName);
                const uniqueNames = new Set(names);
                expect(names.length).to.equal(uniqueNames.size);
            });

            it('should handle only requisites correctly', () => {
                const batch = [
                    { algorithmName: 'b1', requestType: 'batch', isRequisite: true }
                ];
                const streaming = [
                    { algorithmName: 's1', requestType: stateType.Stateful, stateType: stateType.Stateful, isRequisite: true }
                ];

                const result = requestsManager._merge(batch, streaming);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['s1', 'b1']);
            });

            it('should handle only non-requisite streaming', () => {
                const streaming = [
                    { algorithmName: 's1', requestType: stateType.Stateful, stateType: stateType.Stateful },
                    { algorithmName: 's2', requestType: stateType.Stateless, stateType: stateType.Stateless }
                ];

                const result = requestsManager._merge([], streaming);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['s1', 's2']);
            });

            it('should handle only non-requisite batch', () => {
                const batch = [
                    { algorithmName: 'b1', requestType: 'batch' },
                    { algorithmName: 'b2', requestType: 'batch' }
                ];

                const result = requestsManager._merge(batch, []);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['b1', 'b2']);
            });

            it('should preserve internal order within each category', () => {
                const batch = [
                    { algorithmName: 'b1', requestType: 'batch' },
                    { algorithmName: 'b2', requestType: 'batch' }
                ];
                const streaming = [
                    { algorithmName: 's1', requestType: stateType.Stateful, stateType: stateType.Stateful },
                    { algorithmName: 's2', requestType: stateType.Stateless, stateType: stateType.Stateless }
                ];

                const result = requestsManager._merge(batch, streaming);
                expect(result.map(r => r.algorithmName)).to.deep.equal(['s1', 's2', 'b1', 'b2']);
            });
        });
    });

    describe('JobsHandler Class', () => {
        const workerResources = { mem: 512, cpu: 0.1 }

        beforeEach(() => {
            // Default/init state
            jobsHandler.createdJobsLists = { batch: [], [stateType.Stateful]: [], [stateType.Stateless]: [] };
            jobsHandler.unScheduledAlgorithms = {};
            jobsHandler.ignoredUnScheduledAlgorithms = {};
        });

        describe('clearCreatedJobsLists Method', () => {
            it('should remove jobs that exceed the TTL from all categories', () => {
                const now = Date.now();
                jobsHandler.createdJobsLists = {
                    batch: [
                        { createdTime: now - 10000 },
                        { createdTime: now - 2000 }
                    ],
                    Stateful: [
                        { createdTime: now - 5000 },
                        { createdTime: now - 1000 }
                    ],
                    Stateless: [
                        { createdTime: now - 9000 },
                        { createdTime: now - 100 }
                    ]
                };

                jobsHandler.clearCreatedJobsLists(3000, now);

                expect(jobsHandler.createdJobsLists.batch).to.have.lengthOf(1);
                expect(jobsHandler.createdJobsLists.Stateful).to.have.lengthOf(1);
                expect(jobsHandler.createdJobsLists.Stateless).to.have.lengthOf(1);

                expect(jobsHandler.createdJobsLists.batch[0].createdTime).to.equal(now - 2000);
                expect(jobsHandler.createdJobsLists.Stateful[0].createdTime).to.equal(now - 1000);
                expect(jobsHandler.createdJobsLists.Stateless[0].createdTime).to.equal(now - 100);
            });

            it('should not remove any jobs if all are within the TTL', () => {
                const now = Date.now();
                jobsHandler.createdJobsLists = {
                    batch: [
                        { createdTime: now - 500 },
                        { createdTime: now - 1000 }
                    ],
                    Stateful: [],
                    Stateless: []
                };

                jobsHandler.clearCreatedJobsLists(2000, now);

                expect(jobsHandler.createdJobsLists.batch).to.have.lengthOf(2);
                expect(jobsHandler.createdJobsLists.Stateful).to.be.empty;
                expect(jobsHandler.createdJobsLists.Stateless).to.be.empty;
            });

            it('should remove all jobs if all exceed the TTL', () => {
                const now = Date.now();
                jobsHandler.createdJobsLists = {
                    batch: [
                        { createdTime: now - 8000 },
                        { createdTime: now - 6000 }
                    ],
                    Stateful: [
                        { createdTime: now - 7000 }
                    ],
                    Stateless: [
                        { createdTime: now - 9000 }
                    ]
                };

                jobsHandler.clearCreatedJobsLists(3000, now);

                expect(jobsHandler.createdJobsLists.batch).to.be.empty;
                expect(jobsHandler.createdJobsLists.Stateful).to.be.empty;
                expect(jobsHandler.createdJobsLists.Stateless).to.be.empty;
            });

            it('should handle empty lists gracefully', () => {
                const now = Date.now();
                jobsHandler.createdJobsLists = {
                    batch: [],
                    Stateful: [],
                    Stateless: []
                };

                expect(() => jobsHandler.clearCreatedJobsLists(1000, now)).to.not.throw();
                expect(jobsHandler.createdJobsLists.batch).to.be.empty;
                expect(jobsHandler.createdJobsLists.Stateful).to.be.empty;
                expect(jobsHandler.createdJobsLists.Stateless).to.be.empty;
            });

            it('should default to Date.now() when currentTime is not provided', () => {
                jobsHandler.createdJobsLists = {
                    batch: [{ createdTime: Date.now() - 10 }],
                    Stateful: [],
                    Stateless: []
                };

                expect(() => jobsHandler.clearCreatedJobsLists(1000)).to.not.throw();
                expect(jobsHandler.createdJobsLists.batch).to.have.lengthOf(1);
            });
        });

        describe('_processAllRequests Method', () => {
            const algorithmName = 'alg1';
            const baseRequest = { algorithmName, requestType: 'batch' };
            let reconcileResult = {};
            let allAllocatedJobs;

            beforeEach(() => {
                reconcileResult = {};
                allAllocatedJobs = { idleWorkers: [], pausedWorkers: [], bootstrappingWorkers: [], jobsPendingForWorkers: [] }
            });

            it('should assign request to idle worker', () => {
                allAllocatedJobs.idleWorkers.push({ id: 'w1', algorithmName });
                const requests = [baseRequest];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);

                expect(result.scheduledRequests).to.deep.equal([{ algorithmName, id: 'w1' }]);
                expect(result.createDetails).to.be.empty;
                expect(result.toResume).to.be.empty;
                expect(reconcileResult).to.be.empty;
            });

            it('should assign request to pending worker', () => {
                allAllocatedJobs.jobsPendingForWorkers.push({ id: 'w2', algorithmName });
                const requests = [baseRequest];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);
                
                expect(result.scheduledRequests).to.deep.equal([{ algorithmName, id: 'w2' }]);
                expect(result.createDetails).to.be.empty;
                expect(result.toResume).to.be.empty;
                expect(reconcileResult).to.be.empty;
            });

            it('should assign request to recently created job', () => {
                jobsHandler.createdJobsLists.batch.push({ algorithmName, id: 'w3' } );
                const requests = [baseRequest];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);
                
                expect(result.scheduledRequests).to.deep.equal([{ algorithmName, id: 'w3' }]);
                expect(result.createDetails).to.be.empty;
                expect(result.toResume).to.be.empty;
                expect(reconcileResult).to.be.empty;
            });

            it('should wake up a paused worker and add it to toResume', () => {
                allAllocatedJobs.pausedWorkers.push({ id: 'w4', algorithmName, status: 'paused' });
                const requests = [baseRequest];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);
                
                expect(result.toResume).to.have.lengthOf(1);
                expect(result.toResume[0].id).to.equal('w4');
                expect(result.scheduledRequests).to.deep.equal([{ algorithmName, id: 'w4' }]);
                expect(result.createDetails).to.be.empty;
                expect(reconcileResult).to.be.empty;
            });

            it('should assign request to bootstrap worker', () => {
                allAllocatedJobs.bootstrappingWorkers.push({ id: 'w5', algorithmName });
                const requests = [baseRequest];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);
                
                expect(result.scheduledRequests).to.deep.equal([{ algorithmName, id: 'w5' }]);
                expect(result.createDetails).to.be.empty;
                expect(result.toResume).to.be.empty;
                expect(reconcileResult).to.be.empty;
            });

            it('should prepare job creation when no worker is available', () => {
                const requests = [baseRequest];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);

                expect(result.createDetails).to.have.lengthOf(1);
                expect(result.createDetails[0].numberOfNewJobs).to.equal(1);
                expect(result.createDetails[0].jobDetails.algorithmName).to.equal(algorithmName);

                expect(reconcileResult).to.have.property(algorithmName);
                expect(reconcileResult.alg1.required).to.equal(1);

                expect(result.scheduledRequests).to.be.empty;
                expect(result.toResume).to.be.empty;
            });

            it('should increment existing reconcileResult if already exists', () => {
                const requests = [baseRequest];
                reconcileResult = { alg1: { required: 2, idle: 0, paused: 0 } };

                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);

                expect(reconcileResult.alg1.required).to.equal(3);
                expect(result.createDetails).to.have.lengthOf(1);
            });

            it('should process multiple requests and handle mixed assignment + creation', () => {
                allAllocatedJobs.idleWorkers.push({ id: 'w1', algorithmName });
                const requests = [baseRequest, { algorithmName: 'alg2', requestType: 'batch' }];
                const result = jobsHandler._processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests,
                     registry, clusterOptions, workerResources, reconcileResult);

                expect(result.scheduledRequests).to.deep.equal([{ algorithmName, id: 'w1' }]);
                expect(result.createDetails).to.have.lengthOf(1);
                expect(result.createDetails[0].jobDetails.algorithmName).to.equal('alg2');
                expect(reconcileResult.alg2.required).to.equal(1);
            });
        });

        describe('_getExtraResources Method', () => {
            it('should return an object with keys allVolumesNames and existingQueuesNames', async () => {
                const result = await jobsHandler._getExtraResources();
                expect(result).to.have.keys(['allVolumesNames', 'existingQueuesNames']);
                const { allVolumesNames, existingQueuesNames } = result;

                // allVolumesNames structure
                expect(allVolumesNames).to.be.an('object');
                expect(allVolumesNames).to.have.keys(['pvcs', 'configMaps', 'secrets']);
                expect(allVolumesNames.pvcs).to.be.an('array');
                expect(allVolumesNames.configMaps).to.be.an('array');
                expect(allVolumesNames.secrets).to.be.an('array');

                // existingQueuesNames structure
                expect(existingQueuesNames).to.be.an('array');
            });
        });

        describe('_getAllVolumeNames Method', () => {
            it('should return an object with keys pvcs, configMaps, and secrets as arrays', async () => {
                const result = await jobsHandler._getAllVolumeNames();
                expect(result).to.have.keys(['pvcs', 'configMaps', 'secrets']);
                expect(result.pvcs).to.be.an('array');
                expect(result.configMaps).to.be.an('array');
                expect(result.secrets).to.be.an('array');
            });
        });

        describe('_findWorkersToStop Method', () => {
            let allAllocatedJobs;

            beforeEach(() => {
                allAllocatedJobs = { idleWorkers: [], activeWorkers: [] }
            });

            it('should return an empty array if there are no skipped jobs', () => {
                const result = jobsHandler._findWorkersToStop([], allAllocatedJobs, {});

                expect(result).to.be.an('array').that.is.empty;
            });

            it('should return workers to stop', () => {
                const algorithmName = 'alg1';
                const { cpu, mem } = algorithmTemplates[algorithmName];
                const resourceRequests = createContainerResource({ cpu, mem });
                const skipped = [ { algorithmName, resourceRequests } ];

                allAllocatedJobs.idleWorkers.push({ id: 'idle-1', algorithmName, podName: 'p1', job: { nodeName: 'n1' } });
                allAllocatedJobs.activeWorkers.push({ id: 'active-1', algorithmName: 'alg2', podName: 'p2', job: { nodeName: 'n2' } });

                const result = jobsHandler._findWorkersToStop(skipped, allAllocatedJobs, algorithmTemplates);

                expect(result).to.be.an('array').that.is.not.empty;
                result.forEach(r => {
                    expect(r).to.have.keys(['count', 'details']);
                    expect(r.count).to.equal(1);
                    expect(r.details).to.include.keys([
                        'algorithmName',
                        'resourceRequests',
                        'nodeName',
                        'podName',
                        'id'
                    ]);
                });
            });

            it('should return empty array if there are no workers', () => {
                const algorithmName = 'alg1';
                const { cpu, mem } = algorithmTemplates[algorithmName];
                const resourceRequests = createContainerResource({ cpu, mem });
                const skipped = [ { algorithmName, resourceRequests } ];

                const result = jobsHandler._findWorkersToStop(skipped, allAllocatedJobs, algorithmTemplates);

                expect(result).to.be.an('array').that.is.empty;
            });
        });

        describe('_createStopDetails Method', () => {
            const algorithmName = 'alg1';
            const baseWorker = { id: 'worker-1', algorithmName, podName: 'pod-1' };
            it('should return correct stop details for a worker', () => {
                const worker = { ...baseWorker, job: { nodeName: 'node-1' } };

                const result = jobsHandler._createStopDetails({ worker, algorithmTemplates });
                const { cpu, mem } = algorithmTemplates[algorithmName];
                const expectedResources = createContainerResource({ cpu, mem });

                expect(result).to.have.property('count', 1);
                expect(result).to.have.property('details');
                expect(result.details).to.include({
                    algorithmName,
                    nodeName: 'node-1',
                    podName: 'pod-1',
                    id: 'worker-1'
                });
                expect(result.details.resourceRequests).to.be.an('object');
                expect(result.details.resourceRequests).to.deep.equal(expectedResources)
            });

            it('should return null nodeName if job is missing', () => {
                const result = jobsHandler._createStopDetails({ worker: baseWorker, algorithmTemplates });
                expect(result.details.nodeName).to.be.null;
            });
        });

        describe('_filterWorkersToStop Method', () => {
            it('should return the same list if there are no workers to resume', () => {
                const toStop = [ { algorithmName: 'alg1' }, { algorithmName: 'alg2' } ];
                const toResume = [];

                const result = jobsHandler._filterWorkersToStop(toStop, toResume);

                expect(result).to.deep.equal(toStop);
            });

            it('should remove workers from toStop that match algorithmName in toResume', () => {
                const toStop = [ { algorithmName: 'alg1' }, { algorithmName: 'alg2' }, { algorithmName: 'alg3' } ];
                const toResume = [ { algorithmName: 'alg2' } ];

                const result = jobsHandler._filterWorkersToStop(toStop, toResume);

                expect(result).to.deep.equal([ { algorithmName: 'alg1' }, { algorithmName: 'alg3' } ]);
            });

            it('should handle multiple matches and modify toResume in place', () => {
                const toStop = [ { algorithmName: 'alg1' }, { algorithmName: 'alg2' }, { algorithmName: 'alg3' } ];

                const toResume = [ { algorithmName: 'alg1' }, { algorithmName: 'alg3' } ];

                const result = jobsHandler._filterWorkersToStop(toStop, toResume);

                expect(result).to.deep.equal([ { algorithmName: 'alg2' } ]);
                expect(toResume).to.deep.equal([]);
            });

            it('should return empty list if all toStop are matched in toResume', () => {
                const toStop = [ { algorithmName: 'alg1' },  { algorithmName: 'alg2' } ];
                const toResume = [ { algorithmName: 'alg1' }, { algorithmName: 'alg2' } ];

                const result = jobsHandler._filterWorkersToStop(toStop, toResume);

                expect(result).to.deep.equal([]);
                expect(toResume).to.deep.equal([]);
            });

            it('should not remove unmatched workers from toResume', () => {
                const toStop = [ { algorithmName: 'alg1' } ];
                const toResume = [ { algorithmName: 'alg2' } ];

                const result = jobsHandler._filterWorkersToStop(toStop, toResume);

                expect(result).to.deep.equal(toStop);
                expect(toResume).to.deep.equal([{ algorithmName: 'alg2' }]);
            });
        });

        describe('_createJobs Method', () => {
            let mockJobsHandler;
            let shouldFail;
            const fakeJob1 = { algorithmName: 'alg1' };
            const fakeJob2 = { algorithmName: 'alg2' };
            const options = {};

            before(() => {
                mockJobsHandler = { ...jobsHandler };
                mockJobsHandler._createJobs = jobsHandler._createJobs;
                mockJobsHandler._createJob = async (jobDetails) => (
                    shouldFail.includes(jobDetails.algorithmName) ? {
                        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
                        jobDetails,
                        message: 'error with creating',
                        spec: {}
                    } : { statusCode: StatusCodes.OK, jobDetails }
                );
            });

            beforeEach(() => {
                shouldFail = [];
            });

            it('should return successfully created jobs and failed jobs with warnings', async () => {
                shouldFail.push(fakeJob2.algorithmName);
                const jobsToRequest = [fakeJob1, fakeJob2];
                const result = await mockJobsHandler._createJobs(jobsToRequest, options);

                expect(result).to.be.an('object');
                expect(result.created).to.deep.equal([fakeJob1]);
                expect(result.failed).to.have.lengthOf(1);
                expect(result.failed[0]).to.have.property('warning');
                expect(result.failed[0].warning).to.be.an('object');
                expect(result.failed[0].warning).to.not.be.empty;
                expect(result.failed[0].algorithmName).to.equal(fakeJob2.algorithmName);
            });

            it('should return an empty array if no jobs succeed', async () => {
                shouldFail.push(fakeJob1.algorithmName, fakeJob2.algorithmName);
                const jobsToRequest = [fakeJob1, fakeJob2];
                const result = await mockJobsHandler._createJobs(jobsToRequest, options);

                expect(result).to.be.an('object');
                expect(result.created).to.be.an('array').that.is.empty;
                expect(result.failed).to.have.lengthOf(2);
                result.failed.forEach(item => {
                    expect(item).to.be.an('object');
                    expect(item).to.have.property('warning');
                    expect(item.warning).to.be.an('object').that.is.not.empty;
                });
            });

            it('should handle an empty input gracefully', async () => {
                const result = await mockJobsHandler._createJobs([], options);
                expect(result).to.deep.equal({ created: [], failed: [] });
            });
        });

        describe.only('_checkUnscheduled', () => {
            it('should add skipped algorithms to unScheduledAlgorithms', () => {
                const skipped = [{ algorithmName: 'alg1', warning: 'low memory' }];
                const created = [];
                const maxFilteredRequests = [{ algorithmName: 'alg1' }];

                jobsHandler._checkUnscheduled(created, skipped, maxFilteredRequests, algorithmTemplates);

                expect(jobsHandler.unScheduledAlgorithms).to.have.property('alg1', 'low memory');
                expect(jobsHandler.ignoredUnScheduledAlgorithms).to.be.empty;
            });

            it('should remove algorithm if it was created', () => {
                jobsHandler.unScheduledAlgorithms = { alg1: 'some warning' };
                const skipped = [];
                const created = [{ algorithmName: 'alg1' }];
                const maxFilteredRequests = [{ algorithmName: 'alg1' }];

                jobsHandler._checkUnscheduled(created, skipped, maxFilteredRequests, algorithmTemplates);

                expect(jobsHandler.unScheduledAlgorithms).to.be.empty;
                expect(jobsHandler.ignoredUnScheduledAlgorithms).to.have.property('alg1', 'some warning');
            });

            it('should remove algorithm if it was not requested anymore', () => {
                jobsHandler.unScheduledAlgorithms = { alg1: 'some warning' };
                const skipped = [];
                const created = [];
                const requests = [{ algorithmName: 'other' }]; // alg1 missing

                jobsHandler._checkUnscheduled(created, skipped, requests, algorithmTemplates);

                expect(jobsHandler.unScheduledAlgorithms).to.be.empty;
                expect(jobsHandler.ignoredUnScheduledAlgorithms).to.have.property('alg1', 'some warning');
            });

            it('should remove algorithm if template is missing', () => {
                jobsHandler.unScheduledAlgorithms = { alg1: 'some warning' };
                const skipped = [];
                const created = [];
                const maxFilteredRequests = [{ algorithmName: 'alg1' }];
                const { alg1, ...customAlgorithmTemplates } = algorithmTemplates // extract alg1 out of algorithmTemplates
                jobsHandler._checkUnscheduled(created, skipped, maxFilteredRequests, customAlgorithmTemplates);

                expect(jobsHandler.unScheduledAlgorithms).to.be.empty;
                expect(jobsHandler.ignoredUnScheduledAlgorithms).to.have.property('alg1', 'some warning');
            });

            it('should keep algorithm in unScheduledAlgorithms if still skipped and requested and has template', () => {
                jobsHandler.unScheduledAlgorithms = { alg1: 'existing warning' };
                const skipped = [{ algorithmName: 'alg1', warning: 'new warning' }]; // should not override existing
                const created = [];
                const maxFilteredRequests = [{ algorithmName: 'alg1' }];

                jobsHandler._checkUnscheduled(created, skipped, maxFilteredRequests, algorithmTemplates);

                expect(jobsHandler.unScheduledAlgorithms).to.have.property('alg1', 'existing warning');
                expect(jobsHandler.ignoredUnScheduledAlgorithms).to.be.empty;
            });
        });
    });
});