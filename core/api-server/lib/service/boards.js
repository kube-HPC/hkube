const storageManager = require('@hkube/storage-manager');
const { boardStatuses } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { randomString } = require('../utils');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

class Boards {
    async getTensorboard(options, type) {
        const response = await stateManager.getTensorboard(options, type);
        if (!response) {
            throw new ResourceNotFoundError('board', JSON.stringify(options));
        }
        return response;
    }

    async stopTensorboard(options, type) {
        await this.getTensorboard(options, type); // check board exists
        await stateManager.deleteTensorBoard(options, type);
    }

    async startTensorboard(options, type) {
        validator.validateBoardStartReq(options, type);
        const existingBoard = await stateManager.getTensorboard(options, type);
        const logDir = await storageManager.hkubeAlgoMetrics.getMetricsPath(options);
        const boardId = randomString();
        const boardLink = `hkube/board/${boardId}`;
        const board = {
            boardId,
            boardLink,
            logDir,
            status: boardStatuses.PENDING,
            result: null,
            error: null,
            endTime: null,
            startTime: Date.now(),
            ...options
        };
        if (existingBoard) {
            if (existingBoard.status === boardStatuses.RUNNING || existingBoard.status === boardStatuses.PENDING) {
                throw new ActionNotAllowed('board: already started', `board ${JSON.stringify(options)} \n already started and is in ${board.status} status`);
            }
            return stateManager.updateTensorBoard(board, type);
        }

        return stateManager.setTensorboard(board, type);
    }
}

module.exports = new Boards();
