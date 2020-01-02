const storageManager = require('@hkube/storage-manager');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
const States = require('../state/States');


class Boards {
    async getTensorboard(options) {
        const response = await stateManager.getTensorboard({ boardId: options.name });
        if (!response) {
            throw new ResourceNotFoundError('board', options.name);
        }
        const { boardId, ...resp } = response;
        resp.name = boardId;
        resp.relativeUrl = `hkube/board/${boardId}`;
        return resp;
    }

    async stopTensorboard(options) {
        const { name } = options;
        await this.getTensorboard({ name }); // check board exists
        const boardData = {
            boardId: name
        };
        await stateManager.deleteTensorBoard(boardData);
    }

    async startTensorboard(options) {
        const { jobId, nodeName, pipelineName, name, taskId } = options;
        validator.validateBoardStartReq({ name, pipelineName, nodeName, jobId, taskId });
        const boardId = options.name;
        const existingBoard = await stateManager.getTensorboard({ boardId });
        const logDir = await storageManager.hkubeAlgoMetrics.getMetricsPath(options);
        const board = {
            boardId,
            taskId,
            jobId,
            logDir,
            status: States.PENDING,
            result: null,
            error: null,
            endTime: null,
            startTime: Date.now()
        };
        if (existingBoard) {
            if (existingBoard.status === States.RUNNING || existingBoard.status === States.PENDING) {
                throw new ActionNotAllowed(`board ${boardId} already started`, `board ${boardId} already started and is in ${board.status} status`);
            }
            return stateManager.updateTensorBoard(board);
        }

        return stateManager.setTensorboard(board);
    }
}

module.exports = new Boards();
