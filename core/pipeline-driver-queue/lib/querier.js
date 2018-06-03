/* eslint-disable */
const getPipelineName = queue => pipelineName => queue.filter(job => job.pipelineName === pipelineName);
const getJobId = queue => jobID => queue.filter(job => job.jobID === jobID);
const getHighestScore = queue => () => (queue.length === 0 ? null : queue[0]);
const getScoreJobIdArray = queue => () => queue.map(job => ({jobID: job.jobID, score: job.calculated.score})); 
const getListOfJobsIDs = queue => () => { 
    const reduced = queue.reduce((acc, curr) => { 
        if (acc[curr.jobID] == null) {
            acc[curr.jobID] = {
                [curr.nodeName]: {length: 1}
            };
        }
        else {
            acc[curr.jobID][curr.nodeName]
                ? acc[curr.jobID][curr.nodeName].length++
                : acc[curr.jobID][curr.nodeName] = {length: 1}; 
        }
        return acc;
    }, {});
    return reduced;
}; 

const Querier = queue => (
    {
        getPipelineName: getPipelineName(queue),
        getJobId: getJobId(queue),
        getHighestScore: getHighestScore(queue),
        getScoreJobIdArray: getScoreJobIdArray(queue),
        getListOfJobsIDs: getListOfJobsIDs(queue)
    }); 

module.exports = Querier;
