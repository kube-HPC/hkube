const groupBy = require('lodash.groupby');

class GroupBy {
    text(grouped) {
        return Object.entries(grouped)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
    }

    groupBy(array, prop) {
        return groupBy(array, prop);
    }

    reduce(grouped) {
        const map = Object.create(null);
        return Object.entries(grouped)
            .map(([k, v]) => ({ key: k, count: v.length }))
            .reduce((prev, cur) => {
                const data = prev;
                data[cur.key] = cur.count;
                return data;
            }, map);
    }
}

module.exports = new GroupBy();
