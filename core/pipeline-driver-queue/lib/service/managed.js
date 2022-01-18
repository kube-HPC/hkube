const queueRunner = require('../queue-runner');
const PagingBase = require('./pagingBase');

class Managed extends PagingBase {
    _filteredFlatJobList(filter) {
        let filteredList;
        if (filter) {
            filteredList = queueRunner.queue.queue.filter(job => {
                if (filter.pipelineName) {
                    return job.pipelineName === filter.pipelineName;
                }
                if (filter.tag) {
                    return job.tags?.findIndex((tag) => tag === filter.tag) > -1;
                }
                return true;
            });
        }
        else filteredList = queueRunner.queue.queue;
        return filteredList.map(job => {
            const { score, calculated, next, ...rest } = job;
            return rest;
        });
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
                job.tags.forEach((tag) => {
                    aggregationByValue = this.addToAggregation(tag, aggregationByValue);
                });
            }
        });
        return Object.values(aggregationByValue);
    }
}
module.exports = new Managed();
