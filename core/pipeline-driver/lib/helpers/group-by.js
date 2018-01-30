const groupBy = require('lodash.groupby');

class GroupBy {

    create(array, property) {
        this._grouped = groupBy(array, property);
        return this;
    }

    group() {
        return this._grouped;
    }

    text() {
        return Object.entries(this._grouped).map(([k, v]) => `${v.length} ${k}`).join(', ');
    }
}

module.exports = GroupBy;