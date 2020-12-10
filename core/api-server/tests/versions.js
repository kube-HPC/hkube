const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const HttpStatus = require('http-status-codes');
const { request, defaultProps } = require('./utils');
let restUrl, restPath;

describe('Versions/Algorithms', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/versions/algorithms`;
    });
    describe('get', () => {
        it('should succeed to get list of zero versions', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage = 'test-algorithmImage';
            const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage }) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            await request(applyReq)
            const res = await request(versionReq);
            expect(res.body).to.have.lengthOf(1);
        });
        it('should succeed to get version', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage = 'test-algorithmImage';
            const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage }) } };
            const res1 = await request(applyReq);
            const version = res1.body.algorithm.version;
            const versionReq = { uri: `${restPath}/${name}/${version}`, method: 'GET' };
            const res2 = await request(versionReq);
            expect(res2.body.version).to.eql(version);
        });
        it('should succeed to get versions', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage';
            const algorithmImage2 = 'new-test-algorithmImage';
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            await request(applyReq1);
            await request(applyReq2);
            const res = await request(versionReq);
            const semver = res.body.map(v => v.semver);
            expect(res.body).to.have.lengthOf(2);
            expect(semver).to.eql(['1.0.1', '1.0.0']);
        });
    });
    describe('delete', () => {
        it('should failed to remove used version', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-21';
            const algorithmImage2 = 'test-algorithmImage-2';
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };

            const res1 = await request(applyReq1);
            await request(applyReq2);

            const version = res1.body.algorithm.version;
            const versionReq1 = { uri: `${restPath}/apply`, body: { version, name } };

            await request(versionReq1);
            const deleteReq = { uri: `${restPath}/${name}/${version}`, method: 'DELETE' };
            const res = await request(deleteReq);

            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('unable to remove used version');
        });
        it('should succeed to delete specific version', async () => {
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const algorithmImage3 = 'test-algorithmImage-3';
            const name = `my-alg-${uuid()}`;
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage3 }) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };

            await request(applyReq1);
            const res = await request(applyReq2);
            const version = res.body.algorithm.version;
            const deleteReq = { uri: `${restPath}/${name}/${version}`, method: 'DELETE' };
            await request(applyReq3);

            const res1 = await request(versionReq);
            const res2 = await request(deleteReq);
            const res3 = await request(versionReq);

            expect(res1.body).to.have.lengthOf(3);
            expect(res2.body).to.eql({ deleted: 1 });
            expect(res3.body).to.have.lengthOf(2);
        });
    });
    describe('apply', () => {
        it('should throw validation error of required property name', async () => {
            const body = {
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of required property version', async () => {
            const body = {
                name: `my-alg-${uuid()}`
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal("data should have required property 'version'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const body = {
                name: {}
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of data.version should be string', async () => {
            const body = {
                name: `my-alg-${uuid()}`,
                version: {}
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('data.version should be string');
        });
        it('should throw validation error of algorithm Not Found', async () => {
            const body = {
                name: 'no-such',
                version: 'no-such'
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(res.body.error.message).to.equal(`algorithm ${body.name} Not Found`);
        });
        it('should throw error of running pipelines dependent on algorithm', async function () {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const exeRaw = `${restUrl}/exec/raw`;
            const exeRawPayload = {
                uri: exeRaw,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: name,
                            input: []
                        }
                    ]
                }
            };
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const res1 = await request(applyReq1);
            await request(applyReq2);
            const version = res1.body.algorithm.version;
            const versionReq = { uri: `${restPath}/apply`, body: { version, name, force: false } };
            await request(exeRawPayload);
            const res2 = await request(versionReq);
            expect(res2.body).to.have.property('error');
            expect(res2.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res2.body.error.message).to.equal(`there are 1 running pipelines which dependent on "${name}" algorithm`);
        });
        it('should not throw error of running pipelines dependent on algorithm', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const exeRaw = `${restUrl}/exec/raw`;
            const exeRawPayload = {
                uri: exeRaw,
                body: {
                    name: 'exec_raw',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: name,
                            input: []
                        }
                    ]
                }
            };
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const res1 = await request(applyReq1);
            await request(applyReq2);
            const version = res1.body.algorithm.version;
            const versionReq = { uri: `${restPath}/apply`, body: { version, name, force: true } };
            await request(exeRawPayload);
            const res2 = await request(versionReq);
            const { created, modified, ...alg1 } = res1.body.algorithm;
            const { created: c2, modified: m2, ...alg2 } = res2.body.algorithm;
            expect(alg1).to.eql(alg2);
        });
        it('should succeed to forceUpdate', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const algorithmImage3 = 'test-algorithmImage-3';
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage3 }) } };

            const res1 = await request(applyReq1);
            const res2 = await request(applyReq2);
            const res3 = await request(applyReq3);

            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            const algorithmReq = { uri: `${restUrl}/store/algorithms/${name}`, method: 'GET' };
            const res4 = await request(versionReq);
            const res5 = await request(algorithmReq);

            expect(res1.body.algorithm).to.have.property('version');
            expect(res2.body.algorithm).to.have.property('version');
            expect(res3.body.algorithm).to.have.property('version');

            expect(res4.body).to.have.lengthOf(3);
            expect(res5.body.algorithmImage).to.eql(algorithmImage3)


        });
    });
    describe('tag', () => {
        let uri;
        before(() => {
            uri = `${restPath}/tag`
        })
        it('should throw validation error of required property name', async () => {
            const body = {
            };
            const req = { uri, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of required property version', async () => {
            const body = {
                name: `my-alg-${uuid()}`
            };
            const req = { uri, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal("data should have required property 'version'");
        });
        it('should throw validation error of data.name should be string', async () => {
            const body = {
                name: {}
            };
            const req = { uri, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of data.version should be string', async () => {
            const body = {
                name: `my-alg-${uuid()}`,
                version: {}
            };
            const req = { uri, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('data.version should be string');
        });
        it('should throw validation error of algorithm Not Found', async () => {
            const body = {
                name: `my-alg-${uuid()}`,
                version: 'no-such'
            };
            const req = { uri, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(res.body.error.message).to.equal(`algorithm ${body.name} Not Found`);
        });
        it('should throw validation error of version Not Found', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage = 'test-algorithmImage-1';
            await request({ uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage }) } });
            const res = await request({ uri, body: { version: 'no-such', name } })
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(res.body.error.message).to.equal(`version no-such Not Found`);
        });
        it('should succeed to add tags to version', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage = 'test-algorithmImage-1';
            const applyPayload = {
                name,
                algorithmImage,
            }
            const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload) } };
            const res1 = await request(applyReq);
            const version = res1.body.algorithm.version;
            const body = { version, name, pinned: true, tags: ['fast', 'good'] };
            await request({ uri, body });
            const res2 = await request({ uri: `${restPath}/${name}/${version}`, method: 'GET' });
            expect(res2.body.pinned).to.eql(body.pinned);
            expect(res2.body.tags).to.eql(body.tags);
        });
        it('should succeed to delete tags from version', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage = 'test-algorithmImage-1';
            const applyPayload = {
                name,
                algorithmImage,
            }
            const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload) } };
            const res1 = await request(applyReq);
            const version = res1.body.algorithm.version;
            const body2 = { version, name, pinned: true, tags: ['fast', 'good'] };
            await request({ uri, body: body2 });
            const res2 = await request({ uri: `${restPath}/${name}/${version}`, method: 'GET' });
            const body3 = { version, name, pinned: false, tags: [] };
            await request({ uri, body: body3 });
            const res3 = await request({ uri: `${restPath}/${name}/${version}`, method: 'GET' });
            expect(res2.body.pinned).to.eql(body2.pinned);
            expect(res2.body.tags).to.eql(body2.tags);
            expect(res3.body.pinned).to.eql(body3.pinned);
            expect(res3.body.tags).to.eql(body3.tags);
        });
    });
});