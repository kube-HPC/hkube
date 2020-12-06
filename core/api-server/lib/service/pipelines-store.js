const db = require('../db');

class PipelineStore {
    async updatePipeline(options) {
        await db.pipelines.update(options);
        return options;
    }

    async deletePipeline(options) {
        const { name } = options;
        await db.pipelines.delete({ name });
    }

    async getPipeline(options) {
        const pipeline = await db.pipelines.fetch(options);
        return pipeline;
    }

    // TODO: ADD QUERIES
    async getPipelines() {
        return db.pipelines.fetchAll();
    }

    async insertPipeline(options) {
        await db.pipelines.create(options);
    }
}

module.exports = new PipelineStore();
