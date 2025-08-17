const { expect } = require('chai');
const { workers, jobs, pods, versions } = require('./stub');
const etcd = require('../lib/helpers/etcd');
const { normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeJobs,
    mergeWorkers } = require('../lib/reconcile/normalize');


let algorithmTemplates;
let WorkersStateManager, RequestsManager;

describe.only('Managers tests', () => {
    const registry = { registry: '' }

    describe('WorkersStateManager Class', () => {
        let workersStateManager;

        before(() => {
            ({ WorkersStateManager, RequestsManager } = require('../lib/reconcile/managers'));
        });

        beforeEach(async () => {
            algorithmTemplates = await etcd.getAlgorithmTemplate();
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
                algorithmTemplates['green-alg'].stateType = 'stateful';
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
        
    });
});