class Kinds {
    constructor() {
        this._oldStorage = null;
    }

    async init(options) {
        let error;
        const { kind } = options;
        if (kind === 'stream' && this._kind === 'batch') {
            error = `${kind} is not supported in this algorithm`;
        }
        else {
            const pipelineKind = this._requireKind(kind);
            error = await pipelineKind.init(options);
        }
        return { error };
    }

    async finish(kind) {
        const pipelineKind = this._requireKind(kind);
        await pipelineKind.finish(kind);
    }

    async enrich(dataToEnrich, jobData) {
        const { kind } = jobData;
        const pipelineKind = this._requireKind(kind);
        await pipelineKind.enrich(dataToEnrich, jobData);
    }

    _requireKind(kind) {
        const pipelineKind = require(`./${kind}`); // eslint-disable-line
        return pipelineKind;
    }

    setKind(kind) {
        this._kind = kind;
    }
}

module.exports = new Kinds();
