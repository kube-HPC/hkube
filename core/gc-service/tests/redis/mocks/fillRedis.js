const redis = require('../../../lib/helpers/redis');

const array_chunks = (array, chunk_size) => Array(Math.ceil(array.length / chunk_size))
    .fill()
    .map((_, index) => index * chunk_size)
    .map(begin => array.slice(begin, begin + chunk_size));

const fillRedis = async () => {
    const prefix = '/hkube:pipeline:graph';
    const count = 100;
    const dataSize = 50;
    const data = Buffer.alloc(dataSize, 'x').toString();
    const array = Array.from(Array(count).keys());
    let counter = 0;
    for (const chunk of array_chunks(array, 300)) {
        await Promise.all(chunk.map(a => redis._client.set(`${prefix}/${a}`, JSON.stringify({ timestamp: 1, data }))));
        counter = counter + 300;
        console.log(`wrote ${counter}`)
    }
    console.log('Done')
};

module.exports = fillRedis;