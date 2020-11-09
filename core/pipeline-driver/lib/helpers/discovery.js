/**
 * This method group discovery addresses by host and port.
 * So the algorithm will only do one round-trip to get tasks results.
 *
 * Example:
 * [127.0.0.1, 9020, task1]
 * [127.0.0.1, 9020, task2]
 * [127.0.0.1, 9020, task3]
 *
 * Will transform to this:
 * [127.0.0.1, 9020, task1,task2,task3]
 */

const uniqueDiscovery = (storage) => {
    Object.entries(storage).forEach(([k, v]) => {
        if (!Array.isArray(v)) {
            return;
        }
        const discoveryList = v.filter(i => i.discovery);
        if (discoveryList.length === 0) {
            return;
        }
        const uniqueList = [];
        discoveryList.forEach((item) => {
            const { taskId, storageInfo, ...rest } = item;
            const { host, port } = item.discovery;
            let uniqueItem = uniqueList.find(x => x.discovery.host === host && x.discovery.port === port);

            if (!uniqueItem) {
                uniqueItem = { ...rest, tasks: [] };
                uniqueList.push(uniqueItem);
            }
            uniqueItem.tasks.push(taskId);
        });
        storage[k] = uniqueList;
    });
};

module.exports = uniqueDiscovery;
