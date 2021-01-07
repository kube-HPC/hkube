const { nodeKind } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');
const dataSourceService = require('../service/data-sources');

class DataSources {
    constructor(validator) {
        this._validator = validator;
    }

    async validate(pipeline) {
        const dataSources = pipeline.nodes
            .filter(n => n.kind === nodeKind.DataSource)
            .map(n => n.dataSource);

        if (dataSources.length > 0) {
            const { error } = await dataSourceService.validate(dataSources);
            if (error) {
                throw new InvalidDataError(error);
            }
        }
    }
}

module.exports = DataSources;
