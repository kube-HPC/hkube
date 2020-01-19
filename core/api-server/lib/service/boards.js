const storageManager = require('@hkube/storage-manager');
const { boardStatuses } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { randomString } = require('../utils');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');
const graph = require('./graph');
const execution = require('./execution');
class Boards {
    async getTensorboard(options) {
        const response = await stateManager.getTensorboard(options);
        if (!response) {
            throw new ResourceNotFoundError('board', JSON.stringify(options));
        }
        return response;
    }

    async getTensorboards(options) {
        const response = await stateManager.getTensorboards(options);
        if (!response) {
            throw new ResourceNotFoundError('board', JSON.stringify(options));
        }
        return response;
    }

    async stopTensorboard(options) {
        await this.getTensorboard(options); // check board exists
        const deleteResult = await stateManager.deleteTensorBoard(options);
        return deleteResult;
    }

    generateId(options, type) {
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
        validator.validateCreateBoardReq(options);
        const { jobId, taskId } = options;
        const type = (taskId && 'task') || (jobId && 'batch') || 'node';
        const boardInfo = ((type === 'node') && options) || { ...options, ...(await this.getBoardInfo(options, type)) };
        const id = this.generateId(boardInfo, type);
        const existingBoard = await stateManager.getTensorboard({ id });
        const logDir = await storageManager.hkubeAlgoMetrics.getMetricsPath(boardInfo);
        const boardReference = randomString();
        const boardLink = `hkube/board/${boardReference}`;
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
            ...boardInfo
        };
        if (existingBoard) {
            if (existingBoard.status === boardStatuses.RUNNING || existingBoard.status === boardStatuses.PENDING) {
                throw new ActionNotAllowed('board: already started', `board ${JSON.stringify(options)} \n already started and is in ${board.status} status`);
            }
            return stateManager.updateTensorBoard(board, type);
        }

        stateManager.setTensorboard(board);
        return id;
    }

    async getBoardInfo({ taskId, jobId }, type) {
        const pipeline = await execution.getPipeline({ jobId });
        if (type === 'task') {
            const gr = await graph.getGraphRaw({ jobId });
            const parsedGraph = JSON.parse(gr);
            let foundNode = parsedGraph.nodes.find(node => taskId === node.taskId);
            if (!foundNode) {
                foundNode = parsedGraph.nodes.find(node => node.batch && node.batch.find(batchPart => batchPart.taskId === taskId));
            }
            if (!foundNode) {
                throw new ResourceNotFoundError(`No task ${taskId} in job ${jobId}`);
            }
            return { nodeName: foundNode.nodeName, pipelineName: pipeline.name };
        }
        return { pipelineName: pipeline.name };
    }
}

module.exports = new Boards();
