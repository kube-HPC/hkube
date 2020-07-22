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
        it('should succeed to get versions', async () => {
            const name1 = `my-alg-${uuid()}`;
            const name2 = `${name1}-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage';
            const algorithmImage2 = 'new-test-algorithmImage';
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name: name1, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name: name2, algorithmImage: algorithmImage2 }) } };
            const versionReq = { uri: `${restPath}/${name1}`, method: 'GET' };
            await request(applyReq1);
            await request(applyReq2);
            const res = await request(versionReq);
            expect(res.body[0]).to.eql({ ...defaultProps, name: name1, algorithmImage: algorithmImage1 });
        });
        it('should succeed to apply algorithm version', async () => {
            for (let i = 0; i < 3; i++) {
                const name = `my-alg-${uuid()}`;
                const image = `my-image-${uuid()}`;
                const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: image }) } };
                const versionReq = { uri: `${restPath}/apply`, body: { name, image } };
                await request(applyReq);
                const res = await request(versionReq);
                expect(res.body).to.eql({ ...defaultProps, name, algorithmImage: image });
            }
        });
        it('should succeed to apply algorithm version without overrideImage', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            await request(applyReq1);
            await request(applyReq2);
            const res = await request(versionReq);
            expect(res.body[0]).to.eql({ ...defaultProps, name, algorithmImage: algorithmImage2 });
        });
    });
    describe('delete', () => {
        it('should failed to remove used version', async () => {
            const usedVersion = 'test-algorithmImage-1';
            const name = `my-alg-${uuid()}`;
            const algorithmImage2 = 'test-algorithmImage-2';
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: usedVersion }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const versionReq1 = { uri: `${restPath}/apply`, body: { name, image: usedVersion } };

            await request(applyReq1);
            await request(applyReq2);

            await request(versionReq1);
            const deleteReq = { uri: `${restPath}/${name}?image=${usedVersion}`, method: 'DELETE' };
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
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage3 }) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            const deleteReq = { uri: `${restPath}/${name}?image=${algorithmImage2}`, method: 'DELETE' };

            await request(applyReq1);
            await request(applyReq2);
            await request(applyReq3);

            const res1 = await request(versionReq);
            const res2 = await request(deleteReq);
            const res3 = await request(versionReq);

            expect(res1.body).to.have.lengthOf(2);
            expect(res2.body).to.eql({ deleted: 1 });
            expect(res3.body).to.have.lengthOf(1);
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
        it('should throw validation error of required property image', async () => {
            const body = {
                name: `my-alg-${uuid()}`
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal("data should have required property 'image'");
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
        it('should throw validation error of data.image should be string', async () => {
            const body = {
                name: `my-alg-${uuid()}`,
                image: {}
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('data.image should be string');
        });
        it('should throw validation error of algorithm Not Found', async () => {
            const body = {
                name: `my-alg-${uuid()}`,
                image: 'test-algorithmImage'
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
            const applyPayload2 = {
                name,
                image: algorithmImage2,
                force: false
            }
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
            const versionReq = { uri: `${restPath}/apply`, body: applyPayload2 };

            await request(applyReq1);
            await request(applyReq2);
            await request(exeRawPayload);
            const res = await request(versionReq);

            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal(`there are 1 running pipelines which dependent on "${name}" algorithm`);
        });
        it('should not throw error of running pipelines dependent on algorithm', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const exeRaw = `${restUrl}/exec/raw`;
            const applyPayload2 = {
                name,
                image: algorithmImage2,
                force: true
            }
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
            const versionReq = { uri: `${restPath}/apply`, body: applyPayload2 };

            await request(applyReq1);
            await request(applyReq2);
            await request(exeRawPayload);
            const res = await request(versionReq);

            expect(res.body).to.eql({ ...defaultProps, name, algorithmImage: algorithmImage2 });
        });
        it('should succeed to overrideImage', async () => {
            const name = `my-alg-${uuid()}`;
            const algorithmImage1 = 'test-algorithmImage-1';
            const algorithmImage2 = 'test-algorithmImage-2';
            const algorithmImage3 = 'test-algorithmImage-3';
            const applyPayload1 = {
                name,
                image: algorithmImage1
            }
            const applyPayload2 = {
                name,
                image: algorithmImage2
            }
            const applyPayload3 = {
                name,
                image: algorithmImage3
            }
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage1 }) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage2 }) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify({ name, algorithmImage: algorithmImage3 }) } };

            const versionReq1 = { uri: `${restPath}/apply`, body: applyPayload1 };
            const versionReq2 = { uri: `${restPath}/apply`, body: applyPayload2 };
            const versionReq3 = { uri: `${restPath}/apply`, body: applyPayload3 };

            await request(applyReq1);
            await request(applyReq2);
            await request(applyReq3);

            const res1 = await request(versionReq1);
            const res2 = await request(versionReq2);
            const res3 = await request(versionReq3);

            expect(res1.body).to.eql({ ...defaultProps, name, algorithmImage: algorithmImage1 });
            expect(res2.body).to.eql({ ...defaultProps, name, algorithmImage: algorithmImage2 });
            expect(res3.body.error.message).to.eql(`algorithmVersion ${applyPayload3.image} Not Found`);
        });

    });
});