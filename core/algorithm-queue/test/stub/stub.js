const uuidv4 = require('uuid/v4');
const stubTemplate = ({
    uuid = uuidv4(), pipelineUuid = `pipeline-${uuidv4()}`,
    algorithmName = 'alg name',
    batchPlace = Math.floor((Math.random() * 1000)),
    priority = Math.floor((Math.random() * 5)),
    score = Math.floor((Math.random() * 100))
    , entranceTime = Date.now()
} = {}) => (
    {
        jobId: `${uuid}`,
        pipelineName: `${pipelineUuid}`,
        priority: `${priority}`,
        algorithmName: `${algorithmName}`,
        batchPlace: `${batchPlace}`,
        calculated: {
            score: `${score}`,
            entranceTime: `${entranceTime}`,
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
