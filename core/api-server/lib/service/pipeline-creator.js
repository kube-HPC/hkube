const mergeWith = require('lodash.mergewith');
const { NodesMap: DAG } = require('@hkube/dag');
const { parser, consts } = require('@hkube/parsers');
const { pipelineKind, retryPolicy, stateType } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

const SEPARATORS = {
    EXPRESSION: ',',
    RELATION: '>>',
    AND: '&'
};

const StreamRetryPolicy = {
    [stateType.Stateless]: { policy: retryPolicy.Never },
    [stateType.Stateful]: { policy: retryPolicy.Always, limit: 10000 }
};

class PipelineCreator {
    async buildPipelineOfPipelines(pipeline) {
        let newPipeline = pipeline;
        const duplicates = pipeline.nodes.some(p => p.algorithmName && p.pipelineName);
        if (duplicates.length > 0) {
            throw new InvalidDataError('algorithmName and pipelineName are not allowed in single node');
        }
        const pipelineNames = pipeline.nodes.filter(p => p.pipelineName).map(p => p.pipelineName);
        const pipelinesNames = [...new Set(pipelineNames)];
        if (pipelinesNames.length > 0) {
            const pipelines = await stateManager.getPipelines({ pipelinesNames });
            const flowInput = pipeline.flowInput || {};

            pipelinesNames.forEach(pl => {
                const storedPipeline = pipelines.find(p => p.name === pl);
                if (!storedPipeline) {
                    throw new ResourceNotFoundError('pipeline', pl);
                }
                mergeWith(flowInput, storedPipeline.flowInput);
            });

            const nodes = [];
            const edges = [];
            const validateNodesRelations = false;

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

                                const sourceGraph = new DAG({ nodes: sourceNodes }, { validateNodesRelations });
                                const targetGraph = new DAG({ nodes: targetNodes }, { validateNodesRelations });

                                const sinks = sourceGraph.getSinks();
                                const sources = targetGraph.getSources();

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

    /**
     * This method accept pipeline and check if it is streaming with flows.
     * If it has flows, it creates edges and parsed flow.
     * @example
     * input
     *   streaming: {
     *        flows: {
     *           analyze: "A >> B&C , C >> D"
     *        }}
     *
     * output
     *   edges: [{"source":"A","target":"B"},
     *           {"source":"A","target":"C"},
     *           {"source":"C","target":"D"}]
     *
     *   streaming: {
     *        parsedFlow: {
     *           analyze: [{ source: "A", next: ["B", "C"]}
     *                     { source: "C", next: ["D"]}]
     *        }}
     *
     */
    async buildStreamingFlow(pipeline) {
        const flows = pipeline.streaming?.flows;
        let defaultFlow = pipeline.streaming?.defaultFlow;
        if (pipeline.kind === pipelineKind.Batch) {
            if (flows) {
                throw new InvalidDataError(`streaming flow is only allowed in ${pipelineKind.Stream} pipeline`);
            }
            return pipeline;
        }
        if (!flows) {
            throw new InvalidDataError('please specify a stream flow');
        }
        if (!defaultFlow) {
            if (Object.keys(flows).length > 1) {
                throw new InvalidDataError('please specify a default stream flow');
            }
            [defaultFlow] = Object.keys(flows);
        }

        pipeline.nodes.forEach(node => {
            const type = node.stateType || stateType.Stateless;
            node.retry = StreamRetryPolicy[type]; // eslint-disable-line
        });

        const parsedFlow = {};
        const edges = [];

        Object.entries(flows).forEach(([k, v]) => {
            if (!v) {
                throw new InvalidDataError(`invalid stream flow ${k}`);
            }
            const flow = [];
            const expressions = v.replace(/\s/g, '').split(SEPARATORS.EXPRESSION);
            expressions.forEach((e) => {
                const parts = e.split(SEPARATORS.RELATION);
                if (parts.length === 1) {
                    throw new InvalidDataError(`stream flow ${k} should have valid flow, example: A >> B`);
                }
                parts.forEach((p, i) => {
                    const source = p;
                    const target = parts[i + 1];
                    if (target?.length === 0) {
                        throw new InvalidDataError(`invalid node name after ${source}`);
                    }
                    const sources = source.split(SEPARATORS.AND);
                    const targets = target?.split(SEPARATORS.AND);
                    sources.forEach((s) => {
                        const node = pipeline.nodes.find(n => n.nodeName === s || n.origName === s);
                        if (!node) {
                            throw new InvalidDataError(`invalid node ${s} in stream flow ${k}`);
                        }
                        if (targets?.length > 0) {
                            const next = [];
                            targets.forEach((t) => {
                                next.push(t);
                                const edge = edges.find(d => d.source === s && d.target === t);
                                if (!edge) {
                                    edges.push({ source: s, target: t, types: [consts.relations.CUSTOM_STREAM] });
                                }
                            });
                            flow.push({ source: s, next });
                        }
                    });
                });
            });
            parsedFlow[k] = flow;
        });
        return {
            ...pipeline,
            edges,
            streaming: {
                ...pipeline.streaming,
                parsedFlow,
                defaultFlow
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
                origName: nodeName,
                input
            };
            return node;
        });
    }
}

module.exports = new PipelineCreator();
