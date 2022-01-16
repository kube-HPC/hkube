const { heuristicsName } = require('./consts/index');

class TasksAdapter {
    adaptData({ task, spanId, length }) {
        const latestScores = Object.values(heuristicsName).reduce((acc, cur) => {
            acc[cur] = 0.00001;
            return acc;
        }, {});

        const batchIndex = task.batchIndex || 0;
        const entranceTime = Date.now();

        return {
            jobId: task.jobId,
            taskId: task.taskId,
            status: task.status,
            spanId,
            priority: task.priority,
            entranceTime,
            attempts: 0,
            initialBatchLength: length,
            batchIndex,
            calculated: {
                latestScores,
                //  score: '1-100',
                entranceTime,
                enrichment: {
                    batchIndex: {}
                }
            },
        };
    }
}

module.exports = new TasksAdapter();
