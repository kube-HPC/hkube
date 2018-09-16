/* eslint-disable */
const getPipelineName = queue => pipelineName => queue.filter(job => job.pipelineName === pipelineName);
const getJobId = queue => jobId => queue.filter(job => job.jobId === jobId);
const getHighestScore = queue => () => (queue.length === 0 ? null : queue[0]);
const getScoreJobIdArray = queue => () => queue.map(job => ({ jobId: job.jobId, score: job.calculated.score }));
const getListOfJobsIDs = queue => () => {
    const reduced = queue.reduce((acc, curr) => {
        if (acc[curr.jobId] == null) {
            acc[curr.jobId] = {
                [curr.nodeName]: { length: 1 }
            };
        }
        else {
            acc[curr.jobId][curr.nodeName]
                ? acc[curr.jobId][curr.nodeName].length++
                : acc[curr.jobId][curr.nodeName] = { length: 1 };
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
