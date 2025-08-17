const { expect, should } = require('chai');
const { workers, jobs, pods, versions } = require('./stub');
const etcd = require('../lib/helpers/etcd');
const { stateType } = require('@hkube/consts');


describe('Managers tests', () => {
    const registry = { registry: '' }
    let algorithmTemplates;
    let WorkersStateManager, requestsManager, jobsHandler;

    before(async () => {
        algorithmTemplates = await etcd.getAlgorithmTemplate();
        ({ WorkersStateManager, requestsManager, jobsHandler } = require('../lib/reconcile/managers'));
    });

    beforeEach(async () => {
        algorithmTemplates = await etcd.getAlgorithmTemplate();
    });

    describe('WorkersStateManager Class', () => {
        let workersStateManager;

        beforeEach(async () => {
            workersStateManager = new WorkersStateManager(workers, jobs, pods, algorithmTemplates, versions, registry);
        });

        describe('Constructor', () => {
            it('should build the object with relevant attributes', () => {
                algorithmTemplates['print-every-10-sec'].minHotWorkers = 1;
                workersStateManager = new WorkersStateManager(workers, jobs, pods, algorithmTemplates, versions, registry);
                expect(workersStateManager.normalizedWorkers).to.be.an('array');
                expect(workersStateManager.normalizedWorkers.length).to.be.equal(workers.length);
                expect(workersStateManager.workersToExit).to.be.an('array');
                expect(workersStateManager.workersToExit.length).to.be.equal(0);
                expect(workersStateManager.jobAttachedWorkers).to.be.an('array');
                expect(workersStateManager.jobAttachedWorkers.length).to.be.equal(6); // all the 6 workers in stub data has a job
                expect(workersStateManager.workersToWarmUp).to.be.an('array');
                expect(workersStateManager.workersToWarmUp.length).to.be.equal(1); // print-every-10-sec has 2 workers (not hot)
                expect(workersStateManager.workersToCoolDown).to.be.an('array');
                expect(workersStateManager.workersToCoolDown.length).to.be.equal(4); // 4 workers in stub data are hot, with no requirement for it.
                expect(workersStateManager.workerCategories).to.be.an('object');
                expect(Object.keys(workersStateManager.workerCategories).length).to.be.equal(5); // idle, active, paused, pending, bootstrap
            });
        });

        describe('countBatchWorkers Method', () => {
            it('should count batch workers', () => {
                const batchWorkers = workersStateManager.countBatchWorkers(algorithmTemplates);
                expectedAmount = workersStateManager.workerCategories.idleWorkers.length + workersStateManager.workerCategories.activeWorkers.length;
                expect(batchWorkers).to.equal(expectedAmount); // Suppose to have 5 active and 1 batch workers, all workers algos are batch
            });

            it('should not count non-batch workers', () => {
                algorithmTemplates['green-alg'].stateType = stateType.Stateful;
                const batchWorkers = workersStateManager.countBatchWorkers(algorithmTemplates);
                expectedAmount = workersStateManager.workerCategories.idleWorkers.length + workersStateManager.workerCategories.activeWorkers.length - 1;
                expect(batchWorkers).to.equal(expectedAmount);
            });
        });

        describe('_buildWorkerCategories Method', () => {
            const customTestWorkers = [
                { workerStatus: 'ready', workerPaused: false }, // idle
                { workerStatus: 'working', workerPaused: false }, // active
                { workerStatus: 'ready', workerPaused: true }, // paused
                { workerStatus: 'bootstrap' } // bootstrap
            ];
            const extraJobs = [
                { name: 'job1' }
            ];
            const checkResult = (categorizedWorkers, values) => {
                let count = 0;
                Object.entries(categorizedWorkers).forEach(([category, workers]) => {
                    expect(workers).to.be.an('array');
                    expect(workers.length).to.be.equal(values[category]);
                    count += workers.length;
                });
                return count;
            };
            const buildValues = (idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers) => ({ idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers });

            it('should build worker categories', () => {
                const categorizedWorkers = workersStateManager._buildWorkerCategories(customTestWorkers, extraJobs);
                const values = buildValues(1, 1, 1, 1, 1);
                const total = checkResult(categorizedWorkers, values);
                expect(total).to.equal(customTestWorkers.length + extraJobs.length);
            });

            it('should handle with no workers or extra jobs', () => {
                const categorizedWorkers = workersStateManager._buildWorkerCategories([], []);
                const values = buildValues(0, 0, 0, 0, 0);
                const total = checkResult(categorizedWorkers, values);
                expect(total).to.equal(0);
            });

            it('should handle with no workers and with extraJobs', () => {
                const categorizedWorkers = workersStateManager._buildWorkerCategories([], extraJobs);
                const values = buildValues(0, 0, 0, 1, 0);
                const total = checkResult(categorizedWorkers, values);
                expect(total).to.equal(extraJobs.length);
            });

            it('should handle with workers but no extraJobs', () => {
                const categorizedWorkers = workersStateManager._buildWorkerCategories(customTestWorkers, []);
                const values = buildValues(1, 1, 1, 0, 1);
                const total = checkResult(categorizedWorkers, values);
                expect(total).to.equal(customTestWorkers.length);
            });
        });
    });

    describe('RequestsManager Class', () => {
        let workersStateManager;
        const batchRequest = { algorithmName: 'algo-batch', requestType: 'batch' };
        const statefulRequest = { algorithmName: 'algo-stateful', requestType: stateType.Stateful };
        const statelessRequest = { algorithmName: 'algo-stateless', requestType: stateType.Stateless };

        before(async () => {
            workersStateManager = new WorkersStateManager(workers, jobs, pods, algorithmTemplates, versions, registry);
        });

        beforeEach(async () => {
            requestsManager._totalCapacityNow = 10; // "init"
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
                ({ jobAttachedWorkers } = workersStateManager);
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

        describe('_splitByType Method', () => {
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
                const result = requestsManager._splitByType(requests);
                checkResult(result, 2, 4);
            });

            it('should work with only batch request types', () => {
                const requests = buildRequests(6, 0, 0);
                const result = requestsManager._splitByType(requests);
                checkResult(result, 6, 0);
            });

            it('should work with only streaming request types', () => {
                const requests = buildRequests(0, 3, 3);
                const result = requestsManager._splitByType(requests);
                checkResult(result, 0, 6);
            });

            it('should order stateful requests before stateless requests', () => {
                const statefulCount = 3;
                const requests = buildRequests(0, statefulCount, 3);
                const { streamingRequests } = requestsManager._splitByType(requests);
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
                const result = requestsManager._splitByType([]);
                checkResult(result, 0, 0);
            })
        });

        describe('_prioritizeQuotaGuaranteeRequests Method', () => {
            // This method has nothing to check since it's dependant on other methods (the next tests checking them).
            let workerCategories;
            const categorizedRequests = {
                batchRequests: [batchRequest, batchRequest],
                streamingRequests: [statefulRequest, statefulRequest, statelessRequest, statelessRequest]
            };
            const greenRequest = { algorithmName: 'green-alg', requestType: 'batch' };
            const blackRequest = { algorithmName: 'black-alg', requestType: 'batch' };

            before(() => {
                ({ workerCategories } = workersStateManager);
            });

            it('should return object of requests', () => {
                const result = requestsManager._prioritizeQuotaGuaranteeRequests(categorizedRequests, algorithmTemplates, workerCategories);
                expect(result).to.be.an('object');
                expect(result.batchRequisiteRequests).to.be.an('array');
                expect(result.streamingRequisiteRequests).to.be.an('array');
            });

            describe('_prioritizeQuotaRequisite Method', () => {
                const { batchRequests } = categorizedRequests;
                it('should return the same requests as input when there is no algorithms with quotaGuarantee', () => {
                    const result = requestsManager._prioritizeQuotaRequisite(batchRequests, algorithmTemplates, workerCategories);
                    expect(result).to.be.an('array');
                    expect(result).to.be.deep.equal(categorizedRequests.batchRequests);
                });

                it('should return prioritized requests based on algorithms with quotaGuarantee', () => {
                    const algorithmName = 'green-alg';
                    const existingWorkers = Object.values(workerCategories).reduce((acc, workersCategory) => {
                        return acc + workersCategory.reduce((acc, worker) => {
                            return acc + (worker.algorithmName === algorithmName ? 1 : 0);
                        }, 0);
                    }, 0);
                    algorithmTemplates[algorithmName].quotaGuarantee = existingWorkers + 1;
                    const normRequests = [...batchRequests];
                    normRequests.push(greenRequest);

                    expect(normRequests[0].algorithmName).to.not.equal(algorithmName);
                    const result = requestsManager._prioritizeQuotaRequisite(normRequests, algorithmTemplates, workerCategories);
                    expect(result).to.be.an('array');
                    expect(result[0].algorithmName).to.equal(algorithmName);
                    expect(result[0].isRequisite).to.be.true;
                });

                describe('_createRequisitesRequests Method', () => {
                    const getExisitingWorkersAmount = (algorithmName) => {
                        return Object.values(workerCategories).reduce((acc, workersCategory) => {
                            return acc + workersCategory.reduce((acc, worker) => {
                                return acc + (worker.algorithmName === algorithmName ? 1 : 0);
                            }, 0);
                        }, 0);
                    };

                    it('should return all requests as they are and no requisite if no requisite algorithm exist', () => {
                        const { requests, requisites } = requestsManager._createRequisitesRequests(batchRequests, algorithmTemplates, workerCategories);
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
                        const workerCategoriesStub = { idleWorkers: [], activeWorkers: [], pausedWorkers: [], pendingWorkers: [] };

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, workerCategoriesStub);
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

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, workerCategories);
                        expect(existingWorkers).to.be.above(0, 'The raw worker stub was edited (green-alg)!');
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

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, workerCategories);
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

                        const { requests, requisites } = requestsManager._createRequisitesRequests(normRequests, algorithmTemplates, workerCategories);
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

                    it('should merge the requisite requests correctly when the requisites is first lower requisite algo and than higher requisite algo', () => {
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

                    it('should merge the requisite requests correctly when the requisites is first higher requisite algo and than lower requisite algo', () => {
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
                    })
                });
            });
        });
    });
});