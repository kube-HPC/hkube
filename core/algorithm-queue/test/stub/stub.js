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
        taskId: `task-${uuid}`,
        pipelineName: `${pipelineUuid}`,
        taskData: {
            input: 'data'
        },
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

const stubTask = (batchIndex) => ({
    taskId: `taskId-${uuidv4()}`,
    batchIndex,
    input: `input-${uuidv4()}`

});

const generateConsumedArray = (number = 100) => ({ 
    jobId: `jobID-${uuidv4()}`,
    pipelineName: `pipelineName-${uuidv4()}`,
    nodeName: `nodeName-${uuidv4()}`,
    priority: Math.floor((Math.random() * 5)),
    algorithmName: `algorithmName-${uuidv4()}`, 
    tasks: Array(number).fill().map((o, index) => stubTask(index + 1))
});

const generateArr = (number = 100, staticOptions) => Array(number).fill().map(() => stubTemplate(staticOptions));

module.exports = {
    stubTemplate,
    generateArr,
    generateConsumedArray
    
}; 


// const consumedObject = {
//     jobID: 'jobID',
//     pipelineName: 'pipelineName',
//     nodeName: 'nodeName',
//     priority: 'priority',
//     algorithmName: 'algorithmName'
//     tasks: [
//         {
//             taskId: 'taskId',
//             input: 'input',
//             batchIndex: 'batchIndex' // number in the batch 
//         }
//     ],
// };
