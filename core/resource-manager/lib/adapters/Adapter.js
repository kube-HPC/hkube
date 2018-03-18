
class Adapter {

    constructor(options) {
        this.name = this._replace(options.name);
    }

    _replace(str) {
        if (str.indexOf('-') === -1) {
            return str;
        }
        const arr = str.split('-');
        let first = arr[0];
        let second = arr[1];
        second = second.charAt(0).toUpperCase() + second.slice(1);
        return first + second;
    }
}

module.exports = Adapter;