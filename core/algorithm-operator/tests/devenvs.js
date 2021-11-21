const { expect } = require('chai');
const db = require('../lib/helpers/db');

let reconcile;
let callCount;
describe('devenvs', () => {
    before(() => {
        callCount = global.testParams.jupyterhub.callCount;
        clearCount = global.testParams.jupyterhub.clearCount;
        setList = global.testParams.jupyterhub.setList;
        reconcile = require('../lib/reconcile/devenv').reconcile;

    });
    beforeEach(() => {
        clearCount();
    });
    it('should reconcile empty lists', async () => {
        const res = await reconcile();
        expect(res.added.Jupyter).to.be.empty;
        expect(res.removed.Jupyter).to.be.empty;
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(0);
        expect(callCount('list').length).to.equal(1);
    });

    it('should reconcile and remove', async () => {
        const list=[{ name: 'a1', ready: true }];
        setList(list)
        const res = await reconcile();
        expect(res.added.Jupyter).to.be.empty;
        expect(res.removed.Jupyter.map(i=>({name: i.name}))).to.eql(list.map(i=>({name: i.name})));
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(0);
        expect(callCount('delete').length).to.equal(1);
    });

    it('should reconcile and stop', async () => {
        const list=[{ name: 'a1', ready: true }];
        setList(list)
        await db._db.devenvs.create({name: 'a1', status: 'stopped', type: 'Jupyter'});
        const res = await reconcile();
        expect(res.added.Jupyter).to.be.empty;
        expect(res.stopped.Jupyter.map(i=>({name: i.name}))).to.eql(list.map(i=>({name: i.name})));
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(1);
        expect(callCount('delete').length).to.equal(0);
    });

});