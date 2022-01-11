const { heuristicsName } = require('./consts/index');

const latestScores = Object.values(heuristicsName).reduce((acc, cur) => {
    acc[cur] = 0.00001;
    return acc;
}, {});

class TasksAdapter {
    adaptData(jobData, taskData, initialBatchLength) {
        const batchIndex = taskData.batchIndex || 0;
        const entranceTime = Date.now();

        return {
            ...jobData,
            ...taskData,
            entranceTime,
            attempts: 0,
            initialBatchLength,
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
