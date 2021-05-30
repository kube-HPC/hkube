const arrayToMap = (array) => {
    const init = Object.create(null);
    return array.reduce((map, obj) => {
        map[obj.name] = obj;  // eslint-disable-line
        return map;
    }, init);
};

module.exports = {
    arrayToMap,
};
