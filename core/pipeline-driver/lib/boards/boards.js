const { pipelineTypes } = require('@hkube/consts');

class Boards {
    constructor(options) {
        this.updated = false;
        this.updateBoard = options.updateBoard;
    }

    update(task) {
        if (!this.updated && task.metricsPath?.tensorboard?.path) {
            this.updated = true;
            this.updateBoard({ jobId: task.jobId }, (oldItem) => {
                const types = [...new Set([...oldItem.types || [], pipelineTypes.TENSORBOARD])];
                return { ...oldItem, types };
            });
        }
    }
}

module.exports = Boards;
