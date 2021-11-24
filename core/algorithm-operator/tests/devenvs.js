const { expect } = require('chai');
const { randomString } = require('@hkube/uid');
const db = require('../lib/helpers/db');

let reconcile;
let callCount;
describe('devenvs', () => {
    before(() => {
        callCount = global.testParams.jupyterhub.callCount;
        clearCount = global.testParams.jupyterhub.clearCount;
        setList = global.testParams.jupyterhub.setList;

        callCountK8s = global.testParams.kubernetes.callCount;
        clearCountK8s = global.testParams.kubernetes.clearCount;
        setListK8s = global.testParams.kubernetes.setList;

        reconcile = require('../lib/reconcile/devenv').reconcile;

    });
    beforeEach(() => {
        clearCount();
        clearCountK8s();
    });
    it('should reconcile empty lists', async () => {
        const res = await reconcile();
        expect(res.added.jupyter).to.be.empty;
        expect(res.removed.jupyter).to.be.empty;
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(0);
        expect(callCount('list').length).to.equal(1);
    });

    it('should reconcile and remove', async () => {
        const name = randomString();
        const list = [{ name, ready: true }];
        setList(list)
        const res = await reconcile();
        expect(res.added.jupyter).to.be.empty;
        expect(res.removed.jupyter.map(i => ({ name: i.name }))).to.eql(list.map(i => ({ name: i.name })));
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(0);
        expect(callCount('delete').length).to.equal(1);
    });

    it('should reconcile and stop', async () => {
        const name = randomString();
        const list = [{ name, ready: true }];
        setList(list)
        await db._db.devenvs.create({ name, status: 'stopped', type: 'jupyter' });
        const res = await reconcile();
        expect(res.added.jupyter).to.be.empty;
        expect(res.removed.jupyter).to.be.empty;
        expect(res.stopped.jupyter.map(i => ({ name: i.name }))).to.eql(list.map(i => ({ name: i.name })));
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(1);
        expect(callCount('delete').length).to.equal(0);
    });

    it('should reconcile and add', async () => {
        const name = randomString();
        const list = [];
        setList(list)
        await db._db.devenvs.create({ name, status: 'pending', type: 'jupyter' });
        let res = await reconcile();
        expect(res.added.jupyter.map(i => ({ name: i.name }))).to.eql([{ name }]);
        expect(res.stopped.jupyter).to.be.empty;
        expect(res.removed.jupyter).to.be.empty;
        expect(callCount('create').length).to.equal(1);
        expect(callCount('remove').length).to.equal(0);
        expect(callCount('delete').length).to.equal(0);
        setList([{ name, ready: true }]);
        clearCount();
        res = await reconcile();
        expect(res.added.jupyter).to.be.empty;
        expect(res.stopped.jupyter).to.be.empty;
        expect(res.removed.jupyter).to.be.empty;
        expect(callCount('create').length).to.equal(0);
        expect(callCount('remove').length).to.equal(0);
        expect(callCount('delete').length).to.equal(0);
        const fromDb = await db._db.devenvs.fetch({ name });
        expect(fromDb.status).to.equal('running');
    });
    it('should reconcile and add vscode', async () => {
        const name = randomString();
        const list = [];
        setList(list)
        await db._db.devenvs.create({ name, status: 'pending', type: 'vscode' });
        let res = await reconcile();
        expect(res.added.vscode.map(i => ({ name: i.name }))).to.eql([{ name }]);
        expect(res.stopped.vscode).to.be.empty;
        expect(res.removed.vscode).to.be.empty;
        expect(callCountK8s('deployExposedPod').length).to.equal(1);
        setListK8s([{ metadata: { labels: { name } }, status: { availableReplicas: 1, replicas: 1 } }]);

        clearCountK8s();
        res = await reconcile();
        expect(res.added.vscode).to.be.empty;
        expect(res.stopped.vscode).to.be.empty;
        expect(res.removed.vscode).to.be.empty;
        expect(callCountK8s('deployExposedPod').length).to.equal(0);
        const fromDb = await db._db.devenvs.fetch({ name });
        expect(fromDb.status).to.equal('running');
        expect(fromDb.url).to.equal(`/hkube/vscode/${name}/`);
    });
});