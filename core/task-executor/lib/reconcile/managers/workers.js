const clonedeep = require('lodash.clonedeep');

const { normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeJobs,
    mergeWorkers } = require('../normalize');

class WorkersManager {
    constructor(workers, jobs, pods, algorithmTemplates, versions, registry) {
        this.normWorkers = normalizeWorkers(workers);
        const normJobs = normalizeJobs(jobs, pods, j => (!j.status.succeeded && !j.status.failed));

        // assign created jobs to workers, and list all jobs with no workers.
        const merged = mergeWorkers(this.normWorkers, normJobs);

        // find workers who's image changed
        this.exitWorkers = normalizeWorkerImages(this.normWorkers, algorithmTemplates, versions, registry);
        // subtract the workers which changed from the workers list.
        this.mergedWorkers = merged.mergedWorkers.filter(w => !this.exitWorkers.find(e => e.id === w.id));

        // get a list of workers that should turn 'hot' and be marked as hot.
        this.warmUpWorkers = normalizeHotWorkers(this.mergedWorkers, algorithmTemplates);
        // get a list of workers that should turn 'cold' and not be marked as hot any longer
        this.coolDownWorkers = normalizeColdWorkers(this.mergedWorkers, algorithmTemplates);

        // Categorize workers into idle, active, paused, etc. and clone the created jobs list.
        this.categorizedWorkers = this._categorizeWorkers(this.mergedWorkers, merged);
    }

    countBatchWorkers(algorithmTemplates) {
        const { idleWorkers, activeWorkers } = this.categorizedWorkers;
        const filterCondition = worker => algorithmTemplates[worker.algorithmName]?.stateType === undefined;
        const batchWorkers = idleWorkers.filter(filterCondition);
        const activeBatchWorkers = activeWorkers.filter(filterCondition);
        return batchWorkers.length + activeBatchWorkers.length;
    }

    // Utility function to categorize workers
    _categorizeWorkers(mergedWorkers, merged) {
        // Identify worker types
        const idleWorkers = clonedeep(mergedWorkers.filter(w => this._idleWorkerFilter(w)));
        const activeWorkers = clonedeep(mergedWorkers.filter(w => this._activeWorkerFilter(w)));
        const pausedWorkers = clonedeep(mergedWorkers.filter(w => this._pausedWorkerFilter(w)));
        const bootstrapWorkers = clonedeep(mergedWorkers.filter(w => w.workerStatus === 'bootstrap'));
        // workers that already have a job created but no worker registered yet:
        const pendingWorkers = clonedeep(merged.extraJobs);
        
        return {
            idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers
        };
    }

    _idleWorkerFilter(worker, algorithmName) {
        let match = worker.workerStatus === 'ready' && !worker.workerPaused;
        if (algorithmName) {
            match = match && worker.algorithmName === algorithmName;
        }
        return match;
    }

    _activeWorkerFilter(worker, algorithmName) {
        let match = worker.workerStatus !== 'ready' && !worker.workerPaused && worker.workerStatus !== 'bootstrap';
        if (algorithmName) {
            match = match && worker.algorithmName === algorithmName;
        }
        return match;
    }

    _pausedWorkerFilter(worker, algorithmName) {
        let match = worker.workerStatus === 'ready' && worker.workerPaused;
        if (algorithmName) {
            match = match && worker.algorithmName === algorithmName;
        }
        return match;
    }
}

module.exports = WorkersManager;
