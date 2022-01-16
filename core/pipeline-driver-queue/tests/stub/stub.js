const { uid: uuidv4 } = require('@hkube/uid');
const stubTemplate = ({ score, preference } = {}) => ({
    jobId: `${uuidv4()}`,
    score: score || Math.floor((Math.random() * 100)),
    preference,
    pipeline: {
        pipelineName: `pipeline-${uuidv4()}`,
        priority: Math.floor((Math.random() * 5))
    }
});

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