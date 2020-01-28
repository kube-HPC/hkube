const splitInputToNodes = (input, nodes) => {
    const filteredNodes = [];
    input.forEach((i) => {
        if (typeof i === 'string') {
            const findAt = i.split('@')[1];
            if (findAt) {
                const node = findAt.split('.')[0];
                const filteredInput = nodes.find(n => n === node);
                if (filteredInput) {
                    filteredNodes.push(filteredInput);
                }
            }
        }
    });
    return filteredNodes;
};

module.exports = {
    splitInputToNodes
};
