const storageManager = require('@hkube/storage-manager');
const { boardStatuses } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, InvalidDataError, ActionNotAllowed } = require('../errors');
const ActiveStates = [boardStatuses.PENDING, boardStatuses.CREATING, boardStatuses.RUNNING];

class Boards {
    async getTensorboard(options) {
        const response = await stateManager.getTensorboard({ boardId: options.name });
        if (!response) {
            throw new ResourceNotFoundError('board', options.name);
        }
        const { boardId, ...resp } = response;
        resp.name = boardId;
        return resp;
    }

    async stopTensorboard(options) {
        const { name } = options;
        const board = await this.getTensorboard({ name });
        if (!this.isActiveState(board.status)) {
            throw new InvalidDataError(`unable to stop board ${name} because its in ${board.status} status`);
        }
        const boardData = {
            boardId: name,
            status: boardStatuses.STOPPED,
            endTime: Date.now()
        };
        await stateManager.updateTensorBoard(boardData);
    }

    async startTensorboard(options) {
        validator.validateBoardStartReq({ name: options.name, pipelineName: options.pipelineName, nodeName: options.nodeName, taskId: options.taskId });
        const boardId = options.name;
        const existingBoard = await stateManager.getTensorboard({ boardId });
        const { taskId, ...opt } = options;
        opt.runName = taskId;
        const logDir = await storageManager.hkubeAlgoMetrics.getMetricsPath(opt);
        const board = {
            boardId,
            logDir,
            status: boardStatuses.PENDING,
            result: null,
            error: null,
            endTime: null,
            startTime: Date.now()
        };
        if (existingBoard) {
            if (existingBoard.status === boardStatuses.RUNNING || existingBoard.status === boardStatuses.PENDING) {
                throw new ActionNotAllowed(`board ${boardId} already started`, `board ${boardId} already started and is in ${board.status} status`);
            }
            return stateManager.updateTensorBoard(board);
        }

        return stateManager.setTensorboard(board);
    }

    isActiveState(state) {
        return ActiveStates.includes(state);
    }
}

module.exports = new Boards();
