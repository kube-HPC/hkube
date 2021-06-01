const { uid: uuidv4 } = require('@hkube/uid');
const stubTemplate = ({
    uuid = uuidv4(),
    pipelineUuid = `pipeline-${uuidv4()}`,
    algorithmName = 'alg name',
    batchIndex = Math.floor((Math.random() * 1000)),
    priority = Math.floor((Math.random() * 5)),
    score = Math.floor((Math.random() * 100)),
    entranceTime = Date.now()
} = {}) => (
    {
        jobId: `${uuid}`,
        taskId: `task-${uuid}`,
        pipelineName: pipelineUuid,
        input: [],
        nodeName: `nodeName-${uuidv4()}`,
        entranceTime,
        attempts: 1,
        priority: priority,
        algorithmName: algorithmName,
        batchIndex: batchIndex,
        calculated: {
            score: score,
            entranceTime,
            enrichment: {
                batchIndex: {}
            },
            latestScores: {
            }
        }
    }
);

const generateArr = (number = 100, staticOptions) => Array(number).fill().map(() => stubTemplate(staticOptions));

module.exports = {
    stubTemplate,
    generateArr
};