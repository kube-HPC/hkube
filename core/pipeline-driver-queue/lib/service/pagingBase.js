class PagingBase {
    getFlatJobsList(pageSize, firstJobId, lastJobId, pipelineName, tag) {
        let filter;
        if (tag || pipelineName) {
            filter = {};
            filter.pipelineName = pipelineName;
            filter.tag = tag;
        }
        let hasNext = false;
        let hasPrev = false;
        let firstInSegmentIndex = 0;
        let returnList = this._filteredFlatJobList(filter);
        if (returnList.length > pageSize) {
            if (firstJobId) {
                firstInSegmentIndex = returnList.findIndex((job) => {
                    return job.jobId === firstJobId;
                });
                if (firstInSegmentIndex < 0) {
                    firstInSegmentIndex = 0;
                }
                else if ((firstInSegmentIndex + pageSize) >= returnList.length) {
                    firstInSegmentIndex = returnList.length - pageSize;
                }
            }
            else if (lastJobId) {
                const lastInSegmentIndex = returnList.findIndex((job) => {
                    return job.jobId === lastJobId;
                });
                if (lastInSegmentIndex < 0) {
                    firstInSegmentIndex = 0;
                }
                else if (lastInSegmentIndex - pageSize >= 0) {
                    firstInSegmentIndex = lastInSegmentIndex - pageSize + 1;
                }
                else {
                    firstInSegmentIndex = returnList.length - pageSize;
                }
            }
            else {
                firstInSegmentIndex = 0;
            }
            if (firstInSegmentIndex !== 0) {
                hasPrev = true;
            }
            if ((firstInSegmentIndex + pageSize) < returnList.length) {
                hasNext = true;
            }
            returnList = returnList.slice(firstInSegmentIndex, pageSize + firstInSegmentIndex);
        }
        return { hasNext, hasPrev, returnList };
    }
}
module.exports = PagingBase;
