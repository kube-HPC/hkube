const { expect } = require('chai');
const { templateStoreStub } = require('./stub/discoveryStub');
let db;

describe('bootstrap', () => {
    before(() => {
        db = require('../lib/helpers/db');
    });
    it('should get template store', async () => {
        await Promise.all(templateStoreStub.map(a => db._db.algorithms.update(a)));
        const template = await db.getAlgorithmTemplate({ name: 'algo2' });
        expect(template).to.eql(templateStoreStub[1]);
    });
    it('should list template store', async () => {
        await Promise.all(templateStoreStub.map(a => db._db.algorithms.update(a)));
        const { algorithms, count } = await db.getAlgorithmTemplates();
        expect(algorithms).to.deep.include(templateStoreStub[1]);
        expect(algorithms.length).to.eql(count);
    });
    it('should list template store above limit', async () => {
        await Promise.all([...Array(110).keys()].map(i => db._db.algorithms.update({ name: `key-${i}`, modified: Date.now() })));
        const { algorithms, count } = await db.getAlgorithmTemplates();
        expect(algorithms.length).to.eql(count);
    });
});
