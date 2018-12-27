/* eslint-disable */
const querier = require('../querier');

const BatchPlace = (queue) => {
    const uniqueJobs = querier(queue).getListOfJobsIDs();

    queue.forEach((task) => {
        if (task.calculated.enrichment.batchIndex.currentBatchPlace) {
            const previous = task.calculated.enrichment.batchIndex.currentBatchLength;
            task.calculated.enrichment.batchIndex = {
                ...task.calculated.enrichment.batchIndex,
                previousBatchLength: previous,
                currentBatchLength: uniqueJobs[task.jobId][task.nodeName].length
            };
            //    }
        }
        else {
            task.calculated.enrichment.batchIndex = {
                previousBatchLength: task.initialBatchLength,
                currentBatchLength: task.initialBatchLength,
                currentBatchPlace: task.batchIndex
            };
        }
        const { currentBatchPlace, currentBatchLength, previousBatchLength } = task.calculated.enrichment.batchIndex;

        task.calculated.enrichment.batchIndex.currentBatchPlace = currentBatchPlace - (previousBatchLength - currentBatchLength);
    });
};


module.exports = BatchPlace;

