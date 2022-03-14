class PagingBase {
    getCount() {
        const returnList = this._filteredFlatJobList();
        return returnList.length;
    }

    getFlatJobsList(pageSize, firstJobId, lastJobId, pipelineName, tag, lastJobs = false) {
        let filter;
        if (tag || pipelineName) {
            filter = {};
            filter.pipelineName = pipelineName;
            filter.tag = tag;
        }
        let nextCount = 0;
        let prevCount = 0;
        let firstInSegmentIndex = 0;
        let returnList = this._filteredFlatJobList(filter);
        if (lastJobs) {
            const lastInSegmentIndex = returnList.length - 1;
            if (lastInSegmentIndex < 0 || lastInSegmentIndex - pageSize < 0) {
                firstInSegmentIndex = 0;
            }
            else {
                firstInSegmentIndex = lastInSegmentIndex - pageSize + 1;
            }
        }
        else if (returnList.length > pageSize) {
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
                if (lastInSegmentIndex < 0 || lastInSegmentIndex - pageSize < 0) {
                    firstInSegmentIndex = 0;
                }
                else {
                    firstInSegmentIndex = lastInSegmentIndex - pageSize + 1;
                }
            }
            else {
                firstInSegmentIndex = 0;
            }
        }
        if (firstInSegmentIndex !== 0) {
            prevCount = firstInSegmentIndex;
        }
        if ((firstInSegmentIndex + pageSize) < returnList.length) {
            nextCount = returnList.length - (firstInSegmentIndex + pageSize);
        }
        returnList = returnList.slice(firstInSegmentIndex, pageSize + firstInSegmentIndex);
        return { nextCount, prevCount, returnList };
    }
}
module.exports = PagingBase;
