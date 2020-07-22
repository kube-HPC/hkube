const { uid: uuidv4 } = require('@hkube/uid');
const stubTemplate = ({
    uuid = uuidv4(),
    pipelineUuid = `pipeline-${uuidv4()}`,
    priority = Math.floor((Math.random() * 5)),
    score = Math.floor((Math.random() * 100)),
    entranceTime = Date.now()
} = {}) => (
        {
            jobId: `${uuid}`,
            pipelineName: `${pipelineUuid}`,
            priority: priority,
            entranceTime: entranceTime,
            score,
            calculated: {
                latestScores: {}
            }
        }
    );

const generateConsumedArray = (number = 100) => ({
    jobId: `jobId-${uuidv4()}`,
    pipelineName: `pipelineName-${uuidv4()}`,
    priority: Math.floor((Math.random() * 5))
});

const generateArr = (number = 100, staticOptions) => Array(number).fill().map(() => stubTemplate(staticOptions));

module.exports = {
    stubTemplate,
    generateArr,
    generateConsumedArray
}; 