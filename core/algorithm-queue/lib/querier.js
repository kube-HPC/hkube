
const getPipelineName = queue => pipelineName => queue.filter(job => job.pipelineName === pipelineName);
const getJobId = queue => jobID => queue.find(job => job.jobID === jobID);
const getHighestScore = queue => () => (queue.length === 0 ? null : queue[0]);
const getScoreJobIdArray = queue => () => queue.map(job => ({jobID: job.jobId, score: job.calculated.score})); 


const Querier = queue => (
    {
        getPipelineName: getPipelineName(queue),
        getJobId: getJobId(queue),
        getHighestScore: getHighestScore(queue),
        getScoreJobIdArray: getScoreJobIdArray(queue)
    }); 

module.exports = Querier;
