class PagingBase {
    getFlatJobsList(pageSize, fromJob, toJob, pipelineName, tag) {
        let filter;
        if (tag || pipelineName) {
            filter = {};
            filter.pipelineName = pipelineName;
            filter.tag = tag;
        }
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
}
module.exports = PagingBase;
