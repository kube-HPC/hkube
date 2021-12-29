const queueRunner = require('../queue-runner');
class Managed {
    getFlatJobsList(pageSize, fromJob, toJob, filter) {
        let hasNext = false;
        let hasPrev = false;
        let fromIndex = 0;
        let returnList = this._filteredFlatJobList(filter);
        if (returnList.length > pageSize) {
            if (fromJob) {
                fromIndex = returnList.findIndex((job) => {
                    return job.jobId === fromJob;
                });
                if (fromIndex < 0) {
                    fromIndex = returnList.length - pageSize;
                }
                else if ((fromIndex + pageSize) < returnList.length) {
                    fromIndex += 1;
                }
                else {
                    fromIndex = returnList.length - pageSize;
                }
            }
            else if (toJob) {
                const toIndex = returnList.findIndex((job) => {
                    return job.jobId === toJob;
                });
                if (toIndex < 0) {
                    fromIndex = returnList.length - pageSize;
                }
                else if (toIndex - pageSize > 0) {
                    fromIndex = toIndex - pageSize;
                }
                else {
                    fromIndex = 0;
                }
            }
            else {
                fromIndex = 0;
            }
            if (fromIndex !== 0) {
                hasPrev = true;
            }
            if ((fromIndex + pageSize) < returnList.length) {
                hasNext = true;
            }
            returnList = returnList.slice(fromIndex, pageSize + fromIndex);
        }
        return { hasNext, hasPrev, returnList };
    }

    _filteredFlatJobList(filter) {
        let filteredList;
        if (filter) {
            filteredList = queueRunner.queue.queue.filter(job => {
                if (filter.pipeline) {
                    return job.pipeline === filter.pipeline;
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

    groupBy(propertyName) {
        const groupByValue = {};
        const flatList = this._filteredFlatJobList();
        flatList.forEach((job) => {
            if (propertyName === 'pipeline') {
                let aggregation = groupByValue[job.pipeline];
                if (!aggregation) {
                    aggregation = {};
                    aggregation.name = job.pipeline;
                    aggregation.count = 1;
                    groupByValue[job.pipeline] = aggregation;
                }
                else {
                    aggregation.count += 1;
                }
            }
            if (propertyName === 'tag') {
                job.tags.forEach((tag) => {
                    let aggregation = groupByValue[tag];
                    if (!aggregation) {
                        aggregation = {};
                        aggregation.name = tag;
                        aggregation.count = 1;
                    }
                    else {
                        aggregation.count += 1;
                    }
                });
            }
        });
        return Object.values(groupByValue);
    }
}
module.exports = new Managed();
