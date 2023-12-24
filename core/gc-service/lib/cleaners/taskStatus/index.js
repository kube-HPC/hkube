const BaseCleaner = require('../../core/base-cleaner');
const storeManager = require('../../helpers/store-manager');
const etcdStore = require('../../helpers/etcd');
const tryParseJson = require('../../utils/tryParseJson');

class TaskStatusCleaner extends BaseCleaner {
    async clean() {
        // const { batch, normal } = await this.getGraphs();
        // const fixednormal = await this.handleNormal(normal);

        // checking a new idea

        const graphs = storeManager.getRunningJobsGraphs();

        // subject to change because on moday i will make it so that the methods return a list of objects that
        // have jobId taskId and warning message and these objects will be of the tasks that have new warnings
        // eslint-disable-next-line no-unused-vars
        const warningGraphs = this.checkWarnings(graphs);
    }

    // //old
    // async getGraphs() {
    //     const graphs = await storeManager.getRunningJobsGraphs();
    //     const batch = [];
    //     const normal = [];
    //     let flag = true;
    //     for (let i = 0; i < graphs.length; i += 1) {
    //         for (let j = 0; j < graphs[i].nodes.length; i += 1) {
    //             if ('batch' in graphs[i].nodes[j]) {
    //                 batch.push(graphs[i]);
    //                 flag = false;
    //                 break;
    //             }
    //         }
    //         if (flag) {
    //             normal.push(graphs[i]);
    //         }

    //         flag = true;
    //     }
    //     return { batch, normal };
    // }

    // new
    async checkWarnings(graphs = []) {
        const warningGraphs = [];
        for (let i = 0; i < graphs.length; i += 1) {
            const { jobId } = graphs[i];
            let warningExist = false;

            // eslint-disable-next-line no-await-in-loop
            await Promise.all(graphs[i].nodes.map(async (node) => {
                if ('batch' in node) {
                    // eslint-disable-next-line no-param-reassign
                    ({ batch: node.batch, warningExist } = this.handleBatch(node.batch, jobId));
                }
                const { taskId } = node;
                const path = `/jobs/tasks/${jobId}/${taskId}`;
                const data = await etcdStore.getKeys(path);
                const obj = tryParseJson(data[0]);
                if (obj.status === 'warning') {
                    // eslint-disable-next-line no-param-reassign
                    node.status = 'warning';
                    warningExist = true;
                }
            }));

            if (warningExist === true) {
                warningGraphs.push(graphs[i]);
            }
        }

        return warningGraphs;
    }

    // new
    async handleBatch(batch = [], jobId) {
        let warningExist = false;
        await Promise.all(batch.map(async (task) => {
            const { taskId } = task;
            const path = `/jobs/tasks/${jobId}/${taskId}`;
            const data = await etcdStore.getKeys(path);
            const obj = tryParseJson(data[0]);
            if (obj.status === 'warning') {
                warningExist = true;
                // eslint-disable-next-line no-param-reassign
                task.status = 'warning';
            }
        }));
        return { batch, warningExist };
    }

    // // old
    // async handleNormal(graphs = []) {
    //     const warningGraphs = [];
    //     for (let i = 0; i < graphs.length; i += 1) {
    //         const { jobId } = graphs[i];
    //         let warningExist = false;

    //         // eslint-disable-next-line no-await-in-loop
    //         await Promise.all(graphs[i].nodes.map(async (node) => {
    //             const { taskId } = node;
    //             const path = `/jobs/tasks/${jobId}/${taskId}`;
    //             const data = await etcdStore.getKeys(path);
    //             const obj = tryParseJson(data[0]);
    //             if (obj.status === 'warning') {
    //                 // eslint-disable-next-line no-param-reassign
    //                 node.status = 'warning';
    //                 warningExist = true;
    //             }
    //         }));

    //         if (warningExist === true) {
    //             warningGraphs.push(graphs[i]);
    //         }
    //     }

    //     return warningGraphs;
    // }
}

module.exports = TaskStatusCleaner;
