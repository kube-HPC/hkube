const log = require('@hkube/logger').GetLogFromContainer();
const BaseCleaner = require('../../core/base-cleaner');
const storeManager = require('../../helpers/store-manager');
const etcdStore = require('../../helpers/etcd');
const tryParseJson = require('../../utils/tryParseJson');

class TaskStatusCleaner extends BaseCleaner {
    async clean() {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        log.debug('starting first run of taskStatus Cleaner in the current cycle');
        this.oneCheckCycle();
        await sleep(30000);
        log.debug('starting second run of taskStatus Cleaner in the current cycle');
        await this.oneCheckCycle();
    }

    async oneCheckCycle() {
        const graphs = await storeManager.getRunningJobsGraphs();
        const graphsList = [];
        graphs.forEach(graph => {
            graphsList.push(graph.graph);
            graphsList[graphsList.length - 1].pdIntervalTimestamp = graph.pdIntervalTimestamp;
        });
        const filteredGraphsList = graphsList.filter(graph => Date.now() - graph.pdIntervalTimestamp >= 8000);
        if (filteredGraphsList.length === 0) {
            return;
        }
        graphsList.forEach(graph => {
            // eslint-disable-next-line no-param-reassign
            delete graph.pdIntervalTimestamp;
        });
        await this.handleWarnings(graphsList);
    }

    // new
    async handleWarnings(graphs = []) {
        const warningGraphs = [...graphs];
        for (let i = 0; i < warningGraphs.length; i += 1) {
            const { jobId } = warningGraphs[i];

            // eslint-disable-next-line no-await-in-loop
            await Promise.all(warningGraphs[i].nodes.map(async (node) => {
                if ('batch' in node) {
                    // eslint-disable-next-line no-param-reassign
                    node.batch = await this.handleBatch(node.batch, jobId);
                }
                const { taskId } = node;
                const path = `/jobs/tasks/${jobId}/${taskId}`;
                const data = await etcdStore.getKeys(path);
                const obj = tryParseJson(data[0]);
                if (obj.status === 'warning') {
                    // eslint-disable-next-line no-param-reassign
                    node.status = 'warning';
                }
            }));

            // eslint-disable-next-line no-await-in-loop
            await storeManager._db.Jobs.updateGraph({ jobId, graph: warningGraphs[i] });
        }
    }

    async handleBatch(batch = [], jobId) {
        await Promise.all(batch.map(async (task) => {
            const { taskId } = task;
            const path = `/jobs/tasks/${jobId}/${taskId}`;
            const data = await etcdStore.getKeys(path);
            const obj = tryParseJson(data[0]);
            if (obj.status === 'warning') {
                // eslint-disable-next-line no-param-reassign
                task.status = 'warning';
            }
        }));
        return batch;
    }
}

module.exports = TaskStatusCleaner;
