const mergeWith = require('lodash.mergewith');
const { NodesMap: DAG } = require('@hkube/dag');
const { parser, consts } = require('@hkube/parsers');
const { pipelineKind, nodeKind, retryPolicy, stateType } = require('@hkube/consts');
const gatewayService = require('./gateway');
const debugService = require('./debug');
const outputService = require('./output');
const optimizeService = require('./hyperparams-tuner');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

const SEPARATORS = {
    EXPRESSION: '|',
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
        const pipelineNames = pipeline.nodes
            .filter(n => n.kind === nodeKind.Pipeline)
            .map(n => {
                if (!n.spec?.name) {
                    throw new InvalidDataError(`node ${n.nodeName} must have spec with name`);
                }
                return n.spec.name;
            });
        const pipelinesNames = [...new Set(pipelineNames)];
        if (!pipelinesNames.length) {
            return newPipeline;
        }

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
        return newPipeline;
    }

    async updateDebug(pipeline, debugNode) {
        for (const node of pipeline.nodes) { // eslint-disable-line
            if (node.nodeName === debugNode || pipeline.options?.debugOverride?.includes(node.nodeName)) {
                node.kind = nodeKind.Debug;
            }
            if (node.kind === nodeKind.Debug) {
                const { algorithmName } = node;
                const { algorithmName: newAlgorithmName } = await debugService.createDebug({ algorithmName }); // eslint-disable-line
                node.algorithmName = newAlgorithmName;
            }
        }
        return pipeline;
    }

    async updateOutput(pipeline, jobId) {
        const { name: pipelineName } = pipeline;
        for (const node of pipeline.nodes) { // eslint-disable-line
            if (node.kind === nodeKind.Output) {
                const { spec } = node;
                const { algorithmName: newAlgorithmName } = await outputService.createOutput(pipelineName, jobId, spec); // eslint-disable-line
                node.algorithmName = newAlgorithmName;
            }
        }
        return pipeline;
    }

    async updateOptimize(pipeline, jobId) {
        const { name: pipelineName } = pipeline;
        for (const node of pipeline.nodes) { // eslint-disable-line
            if (node.kind === nodeKind.HyperparamsTuner) {
                const { spec } = node;
                const { algorithmName: newAlgorithmName } = await optimizeService.createHyperparamsTuner(pipelineName, jobId, spec); // eslint-disable-line
                node.algorithmName = newAlgorithmName;
            }
        }
        return pipeline;
    }

    /**
     * This method accept pipeline and check if it is streaming with flows.
     * If it has flows, it creates edges and parsed flow.
     * @example
     * input
     *   streaming: {
     *        flows: {
     *           analyze: "A >> B&C >> D"
     *        }}
     *
     * output
     *   edges: [{"source":"A","target":"B"},
     *           {"source":"A","target":"C"},
     *           {"source":"B","target":"D"},
     *            {"source":"C","target":"D"}]
     *
     *   streaming: {
     *        parsedFlow: {
     *           analyze: [{ source: "A", next: ["B", "C"]}
     *                     { source: "B", next: ["D"]}
     *                     { source: "C", next: ["D"]}]
     *        }}
     *
     */
    async buildStreamingFlow(pipeline, jobId, algorithms) {
        const flows = pipeline.streaming?.flows;
        let defaultFlow = pipeline.streaming?.defaultFlow;
        let gateways;

        if (pipeline.kind === pipelineKind.Batch) {
            if (flows) {
                throw new InvalidDataError(`streaming flow is only allowed in ${pipelineKind.Stream} pipeline`);
            }
            return pipeline;
        }
        if (!flows || Object.keys(flows).length === 0) {
            throw new InvalidDataError('please specify a stream flow');
        }
        if (!defaultFlow) {
            const flowNames = Object.keys(flows);
            if (flowNames.length > 1) {
                throw new InvalidDataError('please specify a default stream flow');
            }
            [defaultFlow] = flowNames;
        }

        for (const node of pipeline.nodes) { // eslint-disable-line
            const algorithm = algorithms.get(node.algorithmName);
            if (algorithm && !node.stateType) {
                node.stateType = algorithm.streamKind || stateType.Stateless;
            }
            const type = node.stateType || stateType.Stateless;
            node.retry = StreamRetryPolicy[type];

            if (node.kind === nodeKind.Gateway) {
                if (!gateways) {
                    gateways = [];
                }
                const { nodeName, spec, stateType: nodeStateType } = node;
                if (nodeStateType && nodeStateType !== stateType.Stateful) {
                    throw new InvalidDataError(`Gateway node ${nodeName} stateType must be "stateful". Got ${nodeStateType}`);
                }
                const { algorithmName, url, streamKind} = await gatewayService.createGateway({ jobId, nodeName, spec }); // eslint-disable-line
                node.stateType = streamKind;
                node.algorithmName = algorithmName;
                gateways.push({ nodeName, url });
            }
        }

        const parsedFlow = {};
        const edges = [];

        Object.entries(flows).forEach(([k, v]) => {
            if (!v) {
                throw new InvalidDataError(`invalid stream flow ${k}`);
            }
            const flow = [];
            const flowEdges = {};
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
                        if (targets?.length) {
                            targets.forEach((t) => {
                                const edgeKey = `${s} >> ${t}`;
                                if (s === t) {
                                    throw new InvalidDataError(`invalid relation found ${edgeKey} in flow ${k}`);
                                }
                                const flowEdge = flowEdges[edgeKey];
                                if (flowEdge) {
                                    throw new InvalidDataError(`duplicate relation found ${edgeKey} in flow ${k}`);
                                }
                                const edgeValue = { source: s, target: t, types: [consts.relations.CUSTOM_STREAM] };
                                flowEdges[edgeKey] = edgeValue;

                                const edge = edges.find(d => d.source === s && d.target === t);
                                if (!edge) {
                                    edges.push(edgeValue);
                                }
                                const fl = flow.find(f => f.source === s);
                                if (fl) {
                                    fl.next.push(t);
                                }
                                else {
                                    flow.push({ source: s, next: [t] });
                                }
                            });
                        }
                    });
                });
            });
            parsedFlow[k] = flow;
        });

        const dag = new DAG({});
        edges.forEach(e => dag.setEdge(e.source, e.target));
        const nodeNames = new Set(dag.getNodeNames());
        const node = pipeline.nodes.find(n => !nodeNames.has(n.nodeName || n.origName));
        if (node) {
            throw new InvalidDataError(`node "${node.nodeName}" does not belong to any flow`);
        }

        const sources = dag.getSources().map(s => pipeline.nodes.find(n => n.nodeName === s));
        const statelessNodes = sources.filter(s => s.stateType === stateType.Stateless);
        if (statelessNodes.length > 0) {
            throw new InvalidDataError(`entry node "${statelessNodes[0].nodeName}" cannot be ${stateType.Stateless} on ${pipeline.kind} pipeline`);
        }

        return {
            ...pipeline,
            edges,
            streaming: {
                ...pipeline.streaming,
                gateways,
                parsedFlow,
                defaultFlow
            }
        };
    }

    _mapNodes(node, pipelines) {
        if (node.spec?.name) {
            const pipeline = pipelines.find(p => p.name === node.spec.name);
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
