
class Utils {
    mapToArray(map, keyVal = ['key', 'value']) {
        return Object.entries(map).map(([k, v]) => ({ [keyVal[0]]: k, [keyVal[1]]: v }));
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