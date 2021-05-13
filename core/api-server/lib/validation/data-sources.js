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
                    const { spec } = node;
                    if (!spec) {
                        throw new InvalidDataError('you must provide a valid data source spec');
                    }
                    const { response, error } = await dataSourceService.validate(spec);
                    if (error) {
                        throw new InvalidDataError(error);
                    }
                    if (spec?.snapshot?.name || spec.id) return node;
                    return { ...node, spec: { id: response.id } };
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
