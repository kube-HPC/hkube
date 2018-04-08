
class Utils {
    mapToArray(map, keyVal = ['key', 'value']) {
        return Object.entries(map).map(([k, v]) => ({ [keyVal[0]]: k, [keyVal[1]]: v }));
    }

    arrayToMap(array, keyVal = ['key', 'value']) {
        const map = Object.create(null);
        return array.reduce((map, obj) => {
            map[obj[keyVal[0]]] = obj[keyVal[1]];
            return map;
        }, map);
    }

    group(array, prop) {
        const map = Object.create(null);
        return array.reduce((prev, cur) => {
            if (cur[prop] in prev) {
                prev[cur[prop]] += 1;
            }
            else {
                prev[cur[prop]] = 1;
            }
            return prev;
        }, map)
    }

    capitalize(str) {
        if (str.indexOf('-') === -1) {
            return str;
        }
        const [first, second] = str.split('-');
        const result = first + second.charAt(0).toUpperCase() + second.slice(1);
        return result;
    }
}

module.exports = new Utils();