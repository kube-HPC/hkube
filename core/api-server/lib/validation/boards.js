const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateCreateTensorBoardReq(board) {
        const { taskId, jobId, nodeName, pipelineName } = board;
        if (taskId && !jobId) {
            throw new InvalidDataError('Must supply jobId');
        }
        if (!nodeName && !taskId) {
            throw new InvalidDataError('Must supply nodeName');
        }
        if (!jobId && !pipelineName) {
            throw new InvalidDataError('Must supply pipeLineName');
        }
    }

    validateCreateOptunaBoardReq(board) {
        const { jobId } = board;
        if (!jobId) {
            throw new InvalidDataError('Must supply jobId');
        }
    }
}

module.exports = ApiValidator;
