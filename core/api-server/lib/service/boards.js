const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, InvalidDataError, ActionNotAllowed } = require('../errors');
const States = require('../state/States');


class Boards {
    async getTensorboard(options) {
        const response = await stateManager.getTensorboard(options);
        if (!response) {
            throw new ResourceNotFoundError('board', options.boardId);
        }
        return response;
    }

    async stopTensorboard(options) {
        const { boardId } = options;
        const board = await this.getTensorboard({ boardId });
        if (!stateManager.isActiveState(board.status)) {
            throw new InvalidDataError(`unable to stop board ${boardId} because its in ${board.status} status`);
        }
        const boardData = {
            boardId,
            status: States.STOPPED,
            endTime: Date.now()
        };
        await stateManager.updateTensorBoard(boardData);
    }

    async startTensorboard(options) {
        validator.validateBoardStartReq({ name: options.name, metricLinks: options.metricLinks });
        const boardId = options.name;
        const existingBoard = await stateManager.getTensorboard({ boardId });
        const logDir = options.metricLinks[0];
        const board = {
            boardId,
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
