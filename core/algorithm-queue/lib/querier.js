const Querier = queue => (
    {
        getPipelineName: getPipelineName(queue),
        getJobId: getJobId(queue),
        getHighestScore: getHighestScore(queue)
    }); 


const getPipelineName = queue => pipelineName => queue.filter(job => job.pipelineName === pipelineName);
const getJobId = queue => jobID => queue.find(job => job.jobID === jobID);
const getHighestScore = queue => () => (queue.length === 0 ? null : queue[0]);

module.exports = Querier;
