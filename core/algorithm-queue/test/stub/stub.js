const uuidv4 = require('uuid/v4');
const stubTemplate = ({
    uuid = uuidv4(), pipelineUuid = `pipeline-${uuidv4()}`,
    algorithmName = 'alg name',
    batchPlace = Math.floor((Math.random() * 1000)),
    proirity = Math.floor((Math.random() * 5)),
    score = Math.floor((Math.random() * 100))
    , enternceTime = Date.now()
} = {}) => (
    {
        jobId: `${uuid}`,
        pipelineName: `${pipelineUuid}`,
        proirity: `${proirity}`,
        algorithmName: `${algorithmName}`,
        batchPlace: `${batchPlace}`,
        calculated: {
            score: `${score}`,
            enternceTime: `${enternceTime}`,
        }
    }
);

const genereateArr = (number = 100, staticOptions) => Array(number).fill().map(() => stubTemplate(staticOptions));

module.exports = {
    stubTemplate,
    genereateArr
    
}; 
