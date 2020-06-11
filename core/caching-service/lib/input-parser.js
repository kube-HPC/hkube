const { parser } = require('@hkube/parsers');

const splitInputToNodes = (input, nodes) => {
    const filteredNodes = [];
    input.forEach((i) => {
        const nodesData = parser.extractNodesFromInput(i);
        const nodesNames = nodesData.filter(n => nodes.includes(n.nodeName));
        if (nodesNames.length > 0) {
            filteredNodes.push(...nodesNames);
        }
    });
    return filteredNodes;
};

module.exports = {
    splitInputToNodes
};
