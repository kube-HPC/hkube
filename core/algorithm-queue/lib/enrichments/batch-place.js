const querier = require('../querier');

const BatchPlace = (queue) => {
    const uniqueJobs = querier(queue).getListOfJobsIDs();
    //   const lengthByJobId = uniqueJobs.map(id => ({id, length: querier(queue).getJobId(id).length}));

    queue.forEach((task) => {
        if (task.calculated.enrichment.batchIndex.currentBatchPlace) {
            // incase of  tasks from the same  job addition 
            // if (lengthByJobId[0].length > task.calculated.enrichment.batchIndex.previousBatchLength) {
            //     task.calculated.enrichment.batchIndex = {
            //         ...task.calculated.enrichment.batchIndex,
            //         previousBatchLength: lengthByJobId[0].length,
            //         currentBatchLength: lengthByJobId[0].length
            //     };
            // }
            // else {
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

