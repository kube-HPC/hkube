const orderBy = require('lodash.orderby');

const mapToArray = (map, keyVal = ['key', 'value']) => {
    return Object.entries(map).map(([k, v]) => ({ [keyVal[0]]: k, [keyVal[1]]: v }));
};

const arrayToMap = (array, keyVal = ['key', 'value']) => {
    const init = Object.create(null);
    return array.reduce((map, obj) => {
        map[obj[keyVal[0]]] = keyVal.length > 1 ? obj[keyVal[1]] : obj;
        return map;
    }, init);
};

const groupBy = (array, prop) => {
    const map = Object.create(null);
    return array.reduce((prev, cur) => {
        if (cur[prop] in prev) {
            prev[cur[prop]] += 1;
        }
        else {
            prev[cur[prop]] = 1;
        }
        return prev;
    }, map);
};

const score = (n, max) => {
    const scaledValue = (Math.abs(max - n) / max) * 10;
    return scaledValue;
};

const filterEnable = (settings, name, type) => {
    const setting = settings[type] && settings[type][name];
    return setting && setting.enable;
};

module.exports = {
    filterEnable,
    mapToArray,
    arrayToMap,
    score,
    groupBy,
    orderBy
};
