const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const HttpStatus = require('http-status-codes');
const { request, defaultProps } = require('./utils');
let restUrl, restPath;

describe('Versions/Algorithms', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/versions/algorithms`;
    });
    describe('getVersions', () => {
        it('should succeed to get list of zero versions', async () => {
            const name = `my-alg-${uuidv4()}`;
            const applyPayload = {
                name,
                algorithmImage: 'test-algorithmImage'
            };
            const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            await request(applyReq)
            const res = await request(versionReq);
            expect(res.body).to.have.lengthOf(0);
        });
        it('should succeed to get list of two versions', async () => {
            const name = `my-alg-${uuidv4()}`;
            const applyPayload1 = {
                name,
                algorithmImage: 'test-algorithmImage'
            }
            const applyPayload2 = {
                name,
                algorithmImage: 'new-test-algorithmImage',
                overrideImage: true
            }
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload1) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload2) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            await request(applyReq1);
            await request(applyReq2);
            const res = await request(versionReq);
            expect(res.body[0]).to.eql({ ...defaultProps, ...applyPayload1 });
        });
        it('should succeed to overrideImage', async () => {
            const name = `my-alg-${uuidv4()}`;
            const applyPayload1 = {
                name,
                algorithmImage: 'test-algorithmImage-1',
                overrideImage: true
            }
            const applyPayload2 = {
                name,
                algorithmImage: 'test-algorithmImage-2',
                overrideImage: true
            }
            const applyPayload3 = {
                name,
                algorithmImage: 'test-algorithmImage-3',
                overrideImage: true
            }
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload1) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload2) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload3) } };

            const versionReq1 = { uri: `${restPath}/apply`, body: applyPayload1 };
            const versionReq2 = { uri: `${restPath}/apply`, body: applyPayload2 };
            const versionReq3 = { uri: `${restPath}/apply`, body: applyPayload3 };

            await request(applyReq1);
            await request(applyReq2);
            await request(applyReq3);

            const res1 = await request(versionReq1);
            const res2 = await request(versionReq2);
            const res3 = await request(versionReq3);

            expect(res1.body).to.eql({ ...defaultProps, ...applyPayload1, });
            expect(res2.body).to.eql({ ...defaultProps, ...applyPayload2 });
            expect(res3.body.error.message).to.eql(`algorithmVersion ${applyPayload3.algorithmImage} Not Found`);
        });
        it('should succeed to delete specific version', async () => {
            const name = `my-alg-${uuidv4()}`;
            const applyPayload1 = {
                name,
                algorithmImage: 'test-algorithmImage-1',
                overrideImage: true
            }
            const applyPayload2 = {
                name,
                algorithmImage: 'test-algorithmImage-2',
                overrideImage: true
            }
            const applyPayload3 = {
                name,
                algorithmImage: 'test-algorithmImage-3',
                overrideImage: true
            }
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload1) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload2) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload3) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            const deleteReq = { uri: `${restPath}/${name}/${applyPayload2.algorithmImage}`, method: 'DELETE' };

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
        it('should succeed to delete all versions', async () => {
            const name = `my-alg-${uuidv4()}`;
            const applyPayload1 = {
                name,
                algorithmImage: 'test-algorithmImage-1',
                overrideImage: true
            }
            const applyPayload2 = {
                name,
                algorithmImage: 'test-algorithmImage-2',
                overrideImage: true
            }
            const applyPayload3 = {
                name,
                algorithmImage: 'test-algorithmImage-3',
                overrideImage: true
            }
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload1) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload2) } };
            const applyReq3 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload3) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            const deleteReq = { uri: `${restPath}/${name}`, method: 'DELETE' };

            await request(applyReq1);
            await request(applyReq2);
            await request(applyReq3);

            const res1 = await request(versionReq);
            const res2 = await request(deleteReq);
            const res3 = await request(versionReq);

            expect(res1.body).to.have.lengthOf(2);
            expect(res2.body).to.eql({ deleted: 2 });
            expect(res3.body).to.have.lengthOf(0);
        });
        it('should failed to apply algorithm version', async () => {
            const name = `my-alg-${uuidv4()}`;
            for (let i = 0; i < 3; i++) {
                const applyPayload = { name, algorithmImage: `test-algorithmImage-${i}` }
                const applyReq = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload) } };
                const versionReq = { uri: `${restPath}/apply`, body: applyPayload };
                await request(applyReq);
                const res1 = await request(versionReq);
                expect(res1.body).to.have.property('error');
                expect(res1.body.error.code).to.equal(HttpStatus.NOT_FOUND);
                expect(res1.body.error.message).to.eql(`algorithmVersion ${applyPayload.algorithmImage} Not Found`);
            }
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
        it('should throw validation error of required property algorithmImage', async () => {
            const body = {
                name: `my-alg-${uuidv4()}`
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req);
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal("data should have required property 'algorithmImage'");
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
        it('should throw validation error of data.algorithmImage should be string', async () => {
            const body = {
                name: `my-alg-${uuidv4()}`,
                algorithmImage: {}
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(res.body.error.message).to.equal('data.algorithmImage should be string');
        });
        it('should throw validation error of algorithm Not Found', async () => {
            const body = {
                name: `my-alg-${uuidv4()}`,
                algorithmImage: 'test-algorithmImage'
            };
            const req = { uri: `${restPath}/apply`, body };
            const res = await request(req)
            expect(res.body).to.have.property('error');
            expect(res.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(res.body.error.message).to.equal(`algorithm ${body.name} Not Found`);
        });

    });
});
