const { InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateCreateBoardReq(board) {
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
}

module.exports = ApiValidator;
