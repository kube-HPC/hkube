const { pipelineTypes } = require('@hkube/consts');

class Boards {
    constructor(options) {
        this.updated = false;
        this.updateBoard = options.updateBoard;
        this.types = options.types;
    }

    update(task) {
        if (!this.updated && task.metricsPath?.tensorboard?.path) {
            this.updated = true;
            const types = [...new Set([...this.types || [], pipelineTypes.TENSORBOARD])];
            this.updateBoard({ jobId: task.jobId, types });
        }
    }
}

module.exports = Boards;
