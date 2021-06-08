
const fillEtcd = async () => {
    const etcd = require('../../../lib/helpers/etcd');
    const prefix = '/workers';
    const count = 10;
    const dataSize = 80;
    const data = Buffer.alloc(dataSize, 'x');
    const array = Array.from(Array(count).keys());
    await Promise.all(array.map(a => etcd._etcd._client.put(`${prefix}/${a}`, { timestamp: 1, data })));
};

module.exports = fillEtcd;