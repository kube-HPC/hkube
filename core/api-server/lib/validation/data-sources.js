const { nodeKind } = require('@hkube/consts');
const { InvalidDataError } = require('../errors');
const dataSourceService = require('../service/data-sources');

class DataSources {
    constructor(validator) {
        this._validator = validator;
    }

    async validate(pipeline) {
        const { nodes } = pipeline;
        const promises = nodes
            .map(async node => {
                if (node.kind === nodeKind.DataSource) {
                    const { dataSource } = node;
                    const { response, error } = await dataSourceService.validate(dataSource);
                    if (error) {
                        throw new InvalidDataError(error);
                    }
                    if (dataSource?.snapshot?.name || dataSource.id) return node;
                    return { ...node, dataSource: { id: response.id } };
                }
                return node;
            });
        const nextNodes = await Promise.all(promises);
        return {
            ...pipeline,
            nodes: nextNodes
        };
    }
}

module.exports = DataSources;
