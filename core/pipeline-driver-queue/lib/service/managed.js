const queueRunner = require('../queue-runner');
const PagingBase = require('./pagingBase');

class Managed extends PagingBase {
    _getCount() {
        return queueRunner.queue.queue.length;
    }

    _filteredFlatJobList(filter) {
        return super._filter(filter, queueRunner.queue);
    }

    addToAggregation(propertyValue, groupedRecords) {
        if (!groupedRecords[propertyValue]) {
            // eslint-disable-next-line no-param-reassign
            groupedRecords[propertyValue] = { name: propertyValue, count: 0 };
        }
        // eslint-disable-next-line no-param-reassign
        groupedRecords[propertyValue].count += 1;
        return groupedRecords;
    }

    groupBy(propertyName) {
        let aggregationByValue = {};
        const flatList = this._filteredFlatJobList();
        flatList.forEach((job) => {
            if (propertyName === 'pipelineName') {
                aggregationByValue = this.addToAggregation(job.pipelineName, aggregationByValue);
            }
            if (propertyName === 'tag') {
                if (job.tags?.length >= 1) {
                    job.tags.forEach((tag) => {
                        aggregationByValue = this.addToAggregation(tag, aggregationByValue);
                    });
                }
                else {
                    aggregationByValue = this.addToAggregation('', aggregationByValue);
                }
            }
        });
        return Object.values(aggregationByValue);
    }
}
module.exports = new Managed();
