const BaseCleaner = require('../../core/base-cleaner');
const storeManager = require('../../helpers/store-manager');

class TaskStatusCleaner extends BaseCleaner {
    async clean() {
        const { batch, normal } = await this.getGraphs();
        batch + normal; // a place holder so i can keep the code without eslint throwing an error
    }

    async getGraphs() {
        const graphs = await storeManager.getRunningJobsGraphs();
        const batch = [];
        const normal = [];
        let flag = true;
        for (let i = 0; i < graphs.length; i += 1) {
            for (let j = 0; j < graphs[i].nodes.length; i += 1) {
                if ('batch' in graphs[i].nodes[j]) {
                    batch.push(graphs[i]);
                    flag = false;
                    break;
                }
            }
            if (flag) {
                normal.push(graphs[i]);
            }

            flag = true;
        }
        return { batch, normal };
    }
}

module.exports = TaskStatusCleaner;
