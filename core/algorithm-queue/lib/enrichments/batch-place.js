const querier = require('../querier');

const BatchPlace = queue => {
    const uniqueJobs = querier(queue).getListOfJobsIDs();
    //   const lengthByJobId = uniqueJobs.map(id => ({id, length: querier(queue).getJobId(id).length}));

    queue.forEach(task => { 
        if (task.calculated.enrichment.batchPlace) {
            // incase of  tasks from the same  job addition 
            // if (lengthByJobId[0].length > task.calculated.enrichment.batchPlace.previousBatchLength) {
            //     task.calculated.enrichment.batchPlace = {
            //         ...task.calculated.enrichment.batchPlace,
            //         previousBatchLength: lengthByJobId[0].length,
            //         currentBatchLength: lengthByJobId[0].length
            //     };
            // }
            // else {
            const previous = task.calculated.enrichment.batchPlace.currentBatchLength;
            task.calculated.enrichment.batchPlace = {
                ...task.calculated.enrichment.batchPlace,
                previousBatchLength: previous,
                currentBatchLength: uniqueJobs[task.jobID][task.nodeName].length
            };
        //    }
        }
        else {
            task.calculated.enrichment.batchPlace = {
                previousBatchLength: task.initialBatchLength,
                currentBatchLength: task.initialBatchLength,
                currentBatchPlace: task.batchPlace 
            };
        }
        const {currentBatchPlace, currentBatchLength, previousBatchLength} = task.calculated.enrichment.batchPlace;
         
        task.calculated.enrichment.batchPlace.currentBatchPlace = currentBatchPlace - (previousBatchLength - currentBatchLength);
    });
};


module.exports = BatchPlace;

