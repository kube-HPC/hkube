const { parser, consts } = require('@hkube/parsers');
const { relations } = consts;

const splitInputToNodes = (input, nodes) => {
    const newNodes = [];
    input.forEach((i) => {
        const nodesData = parser.extractNodesFromInput(i);
        const nodesNames = nodesData.filter(n => nodes.includes(n.nodeName));
        if (nodesNames.length > 0) {
            newNodes.push(...nodesNames);
        }
    });
    return newNodes;
};

const validateType = (nodes) => {
    const node = nodes.find(n => parser.findNodeRelation(n.input, relations.WAIT_ANY));
    if (node) {
        throw new Error(`relation ${relations.WAIT_ANY} for node ${node.nodeName} is not allowed`);
    }
};

module.exports = {
    splitInputToNodes,
    validateType
};
