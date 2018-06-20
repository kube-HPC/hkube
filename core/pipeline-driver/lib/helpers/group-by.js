const groupBy = require('lodash.groupby');

class GroupBy {
    constructor(array, property) {
        this._grouped = groupBy(array, property);
    }

    group() {
        return this._grouped;
    }

    text() {
        return Object.entries(this._grouped).map(([k, v]) => `${v.length} ${k}`).join(', ');
    }
}

module.exports = GroupBy;
