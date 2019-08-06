const { expect } = require('chai');
const { cacheResults } = require('../lib/utils/utils');

const delay = ttl => new Promise(r => setTimeout(() => r(), ttl));
describe('Cache results', () => {
    it('should call external the first time', async () => {
        let count = 10
        const fn = () => { return count++ }
        const cached = cacheResults(fn, 1000)
        let result = await cached();
        expect(result).to.eql(10)
    });
    it('should call external after TTL', async () => {
        let count = 10
        const fn = () => { return count++ }
        const cached = cacheResults(fn, 1000)
        let result = await cached();
        expect(result).to.eql(10)
        result = await cached();
        expect(result).to.eql(10)
        await delay(1500)
        result = await cached();
        expect(result).to.eql(11)
    });
    it('should call with args', async () => {
        const fn = (a) => { return a }
        const cached = cacheResults(fn, 1000)
        let result = await cached(3);
        expect(result).to.eql(3)
        result = await cached(4);
        expect(result).to.eql(3)
        await delay(1500)
        result = await cached(5);
        expect(result).to.eql(5)
    });
});