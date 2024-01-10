const log = require('@hkube/logger').GetLogFromContainer();
const BaseCleaner = require('../../core/base-cleaner');
const storeManager = require('../../helpers/store-manager');
const etcdStore = require('../../helpers/etcd');
const tryParseJson = require('../../utils/tryParseJson');

class TaskStatusCleaner extends BaseCleaner {
    // eslint-disable-next-line no-useless-constructor
    constructor(config) {
        super(config);
        this.INTERVAL = config.config.settings.maxInterval;
    }

    async clean(sleepTime = 30000) {
        const updatedJobIds = [];
        let tmpList = [];
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        log.debug('starting first run of taskStatus Cleaner in the current cycle');
        [tmpList] = await Promise.all([
            this.oneCheckCycle(),
            sleep(sleepTime)
        ]);

        log.debug('starting second run of taskStatus Cleaner in the current cycle');
        updatedJobIds.push(...(await this.oneCheckCycle()));
        updatedJobIds.push(...tmpList);
        return updatedJobIds;
    }

    async oneCheckCycle() {
        const graphs = await storeManager.getRunningJobsGraphs();
        const filteredGraphsList = graphs.filter(element => Date.now() - element.pdIntervalTimestamp >= this.INTERVAL);
        if (filteredGraphsList.length === 0) {
            return [];
        }
        const graphsList = [];
        filteredGraphsList.forEach(element => {
            graphsList.push(element.graph);
        });

        const updatedJobIds = await this.handleWarnings(graphsList);

        return updatedJobIds;
    }

    // new
    async handleWarnings(graphs = []) {
        const warningGraphs = [...graphs];
        const updatedJobIds = [];
        for (let i = 0; i < warningGraphs.length; i += 1) {
            const { jobId } = warningGraphs[i];
            let warningExist = false;
            let warningExistTmp = false;

            // eslint-disable-next-line no-await-in-loop
            await Promise.all(warningGraphs[i].nodes.map(async (node) => {
                if ('batch' in node) {
                    // eslint-disable-next-line no-param-reassign
                    ({ batch: node.batch, warningExistTmp } = await this.handleBatch(node.batch, jobId));
                    if (warningExistTmp) {
                        warningExist = warningExistTmp;
                    }
                }
                else {
                    const { taskId } = node;
                    const path = `/jobs/tasks/${jobId}/${taskId}`;
                    const data = await etcdStore.getKeys(path);
                    const obj = tryParseJson(data[0]);
                    if (obj.status === 'warning' && node.status !== 'warning') {
                    // eslint-disable-next-line no-param-reassign
                        node.status = 'warning';
                        warningExist = true;
                    }
                }
            }));

            if (warningExist) {
                // eslint-disable-next-line no-await-in-loop
                await storeManager._db.jobs.updateGraph({ jobId, graph: warningGraphs[i] });
                updatedJobIds.push(jobId);
            }
        }
        return updatedJobIds;
    }

    async handleBatch(batch = [], jobId) {
        let warningExist = false;
        await Promise.all(batch.map(async (task) => {
            const { taskId } = task;
            const path = `/jobs/tasks/${jobId}/${taskId}`;
            const data = await etcdStore.getKeys(path);
            const obj = tryParseJson(data[0]);
            if (obj.status === 'warning') {
                // eslint-disable-next-line no-param-reassign
                task.status = 'warning';
                warningExist = true;
            }
        }));
        return { batch, warningExist };
    }
}

module.exports = TaskStatusCleaner;
