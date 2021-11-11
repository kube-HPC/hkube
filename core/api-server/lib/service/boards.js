const storageManager = require('@hkube/storage-manager');
const { uid } = require('@hkube/uid');
const { boardStatuses } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
const graph = require('./graph');
const execution = require('./execution');
class Boards {
    async getTensorboard(options) {
        const { id } = options;
        const response = await stateManager.getTensorboard({ id });
        if (!response) {
            throw new ResourceNotFoundError('board', id);
        }
        return response;
    }

    async getTensorboards() {
        const response = await stateManager.getTensorboards();
        return response;
    }

    async stopTensorboard(options) {
        const { id } = options;
        const { deleted } = await stateManager.deleteTensorboard({ id });
        if (deleted === 0) {
            throw new ResourceNotFoundError('board', id);
        }
        return deleted;
    }

    async getOptunaboard(options) {
        const { id } = options;
        const response = await stateManager.getOptunaboard({ id });
        if (!response) {
            throw new ResourceNotFoundError('board', id);
        }
        return response;
    }

    async getOptunaboards() {
        const response = await stateManager.getOptunaboards();
        return response;
    }

    async stopOptunaboard(options) {
        const { id } = options;
        const { deleted } = await stateManager.deleteOptunaboard({ id });
        if (deleted === 0) {
            throw new ResourceNotFoundError('board', id);
        }
        return deleted;
    }

    generateTensorId(options, type) {
        const { nodeName, pipelineName, jobId, taskId } = options;
        if (type === 'task') {
            return `${taskId}`;
        }
        if (type === 'batch') {
            return `${jobId}:${nodeName}`;
        }
        return `${pipelineName}:${nodeName}`;
    }

    async startTensorboard(options) {
        validator.boards.validateCreateTensorBoardReq(options);
        const { jobId, taskId } = options;
        const type = (taskId && 'task') || (jobId && 'batch') || 'node';
        const boardInfo = ((type === 'node') && options) || { ...options, ...(await this.getTensorboardInfo(options, type)) };
        const id = this.generateTensorId(boardInfo, type);
        const existingBoard = await stateManager.getTensorboard({ id });
        const logDir = await storageManager.hkubeAlgoMetrics.getMetricsPath(boardInfo);
        const boardReference = uid();
        const boardLink = `hkube/board/${boardReference}/`;
        const board = {
            id,
            boardReference,
            boardLink,
            logDir,
            status: boardStatuses.PENDING,
            result: null,
            error: null,
            endTime: null,
            startTime: Date.now(),
            type,
            ...boardInfo
        };
        if (existingBoard) {
            if (existingBoard.status === boardStatuses.RUNNING || existingBoard.status === boardStatuses.PENDING) {
                throw new ActionNotAllowed('board: already started', `board ${JSON.stringify(options)} \n already started and is in ${board.status} status`);
            }
            return stateManager.updateTensorboard(board);
        }
        await stateManager.createTensorboard(board);
        return id;
    }

    async startOptunaboard(options) {
        validator.boards.validateCreateOptunaBoardReq(options);
        const { jobId } = options;
        const existingBoard = await stateManager.getOptunaboard({ jobId });
        const boardReference = uid();
        const boardURL = `hkube/board/${boardReference}/dashboard`;
        const board = {
            id: jobId,
            boardReference,
            boardLink: boardURL,
            status: boardStatuses.PENDING,
            result: null,
            error: null,
            endTime: null,
            startTime: Date.now(),
        };
        if (existingBoard) {
            if (existingBoard.status === boardStatuses.RUNNING || existingBoard.status === boardStatuses.PENDING) {
                throw new ActionNotAllowed('board: already started', `board ${JSON.stringify(options)} \n already started and is in ${board.status} status`);
            }
            return stateManager.updateOptunaboard(board);
        }
        await stateManager.createOptunaboard(board);
        return boardURL;
    }

    async getTensorboardInfo({ taskId, jobId, nodeName }, type) {
        const pipeline = await execution.getPipeline({ jobId });
        const parsedGraph = await graph.getGraphRaw({ jobId });
        if (type === 'task') {
            let foundNode = parsedGraph.nodes.find(node => taskId === node.taskId);
            if (!foundNode) {
                foundNode = parsedGraph.nodes.find(node => node.batch && node.batch.find(batchPart => batchPart.taskId === taskId));
            }
            if (!foundNode) {
                throw new ResourceNotFoundError(`No task ${taskId} in job ${jobId}`);
            }
            return { nodeName: foundNode.nodeName, pipelineName: pipeline.name };
        }
        if (!parsedGraph.nodes.some(node => node.nodeName === nodeName)) {
            throw new ResourceNotFoundError('node', `${nodeName} for job ${jobId}`);
        }
        return { pipelineName: pipeline.name };
    }
}

module.exports = new Boards();
