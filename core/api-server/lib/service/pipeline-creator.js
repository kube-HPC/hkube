const mergeWith = require('lodash.mergewith');
const { NodesMap } = require('@hkube/dag');
const { parser } = require('@hkube/parsers');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

class PipelineCreator {
    async buildPipelineOfPipelines(pipeline) {
        let newPipeline = pipeline;
        const pipelinesNodes = pipeline.nodes.filter(p => p.pipelineName);
        if (pipelinesNodes.length > 0) {
            const pipelines = await stateManager.pipelines.list();
            const flowInput = pipeline.flowInput || {};

            pipelinesNodes.forEach(n => {
                const storedPipeline = pipelines.find(p => p.name === n.pipelineName);
                if (!storedPipeline) {
                    throw new ResourceNotFoundError('pipeline', n.pipelineName);
                }
                mergeWith(flowInput, storedPipeline.flowInput);
            });

            const nodes = [];
            const edges = [];

            pipeline.nodes.forEach(node => {
                if (node.input.length > 0) {
                    node.input.forEach((i) => {
                        const results = parser.extractNodesFromInput(i);
                        if (results.length > 0) {
                            results.forEach(r => {
                                const nd = pipeline.nodes.find(n => n.nodeName === r.nodeName);
                                const source = nd;
                                const target = node;

                                const sourceNodes = this._mapNodes(source, pipelines);
                                const targetNodes = this._mapNodes(target, pipelines);

                                nodes.push(...sourceNodes, ...targetNodes);

                                const sourceGraph = new NodesMap({ nodes: sourceNodes });
                                const targetGraph = new NodesMap({ nodes: targetNodes });

                                const sinks = sourceGraph._graph.sinks();
                                const sources = targetGraph._graph.sources();

                                sinks.forEach(s => {
                                    sources.forEach(t => {
                                        edges.push({ source: s, target: t });
                                    });
                                });
                            });
                        }
                        else {
                            const mapNodes = this._mapNodes(node, pipelines);
                            nodes.push(...mapNodes);
                        }
                    });
                }
                else {
                    const mapNodes = this._mapNodes(node, pipelines);
                    nodes.push(...mapNodes);
                }
            });
            const nodesList = nodes.filter((n, i, s) => i === s.findIndex((t) => t.nodeName === n.nodeName));
            newPipeline = {
                ...pipeline,
                flowInput,
                nodes: nodesList,
                edges
            };
        }
        return newPipeline;
    }

    async buildStreamingCustomFlow(pipeline) {
        const customFlow = pipeline?.streaming?.customFlow;
        if (!customFlow) {
            return pipeline;
        }
        const customFlows = {};
        const edges = [];

        Object.entries(customFlow).forEach(([k, v]) => {
            if (!v) {
                throw new InvalidDataError(`invalid custom flow ${k}`);
            }
            const flow = [];
            const expressions = v.replace(/\s/g, '').split(',');
            expressions.forEach((e) => {
                const parts = e.split('>>');
                if (parts.length === 1) {
                    throw new InvalidDataError(`custom flow ${k} should have valid flow, example: A >> B`);
                }
                parts.forEach((p, i) => {
                    const source = p;
                    const target = parts[i + 1];
                    const sources = source.split('&');
                    const targets = target?.split('&');
                    sources.forEach((s) => {
                        const node = pipeline.nodes.find(n => n.nodeName === s);
                        if (!node) {
                            throw new InvalidDataError(`invalid node ${s} in custom flow ${k}`);
                        }
                        node.isCustomFlow = true;
                        if (targets?.length > 0) {
                            const next = [];
                            targets.forEach((t) => {
                                next.push(t);
                                const edge = edges.find(d => d.source === s && d.target === t);
                                if (!edge) {
                                    edges.push({ source: s, target: t });
                                }
                            });
                            flow.push({ source: s, next });
                        }
                    });
                });
            });
            customFlows[k] = flow;
        });
        return {
            ...pipeline,
            edges,
            streaming: {
                ...pipeline.streaming,
                customFlows
            }
        };
    }

    _mapNodes(node, pipelines) {
        if (node.pipelineName) {
            const pipeline = pipelines.find(p => p.name === node.pipelineName);
            const nodes = this._mapInput(pipeline.nodes, node.nodeName);
            return nodes;
        }
        return [node];
    }

    _mapInput(nodes, nodeName) {
        return nodes.map(n => {
            const input = parser.replaceNodeInput(n.input, nodeName);
            const node = {
                ...n,
                nodeName: `${nodeName}-${n.nodeName}`,
                input
            };
            return node;
        });
    }
}

module.exports = new PipelineCreator();
