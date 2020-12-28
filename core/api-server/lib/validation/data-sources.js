const { nodeKind } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');
const dataSourceService = require('../service/data-sources');

class DataSources {
    constructor(validator) {
        this._validator = validator;
    }

    async validate(pipeline) {
        const dataSources = [];
        pipeline.nodes.forEach(node => {
            if (node.kind === nodeKind.DataSource) {
                if (!node.dataSource) {
                    throw new InvalidDataError('you must provide a valid dataSource');
                }
                dataSources.push(node.dataSource);
            }
        });
        if (dataSources.length > 0) {
            const { error, } = await dataSourceService.validate(dataSources);
            if (error) {
                throw new InvalidDataError(error.message);
            }
        }
    }
}

module.exports = DataSources;
