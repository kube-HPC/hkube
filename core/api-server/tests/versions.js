const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl, restPath;
const defaultProps = {
    minHotWorkers: 0,
    options: {
        debug: false,
        pending: false
    },
    mem: "256Mi",
    type: "Image"
}

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
                algorithmImage: 'new-test-algorithmImage'
            }
            const applyReq1 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload1) } };
            const applyReq2 = { uri: `${restUrl}/store/algorithms/apply`, formData: { payload: JSON.stringify(applyPayload2) } };
            const versionReq = { uri: `${restPath}/${name}`, method: 'GET' };
            await request(applyReq1);
            await request(applyReq2);
            const res = await request(versionReq);
            expect(res.body[0]).to.eql({ applyPayload1, ...defaultProps });
        });
        it.only('should succeed to apply algorithm version', async () => {
            const name = `my-alg-${uuidv4()}`;
            const applyPayload1 = {
                name,
                algorithmImage: 'test-algorithmImage-1'
            }
            const applyPayload2 = {
                name,
                algorithmImage: 'test-algorithmImage-2'
            }
            const applyPayload3 = {
                name,
                algorithmImage: 'test-algorithmImage-3'
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

            expect(res1.body).to.eql({ applyPayload1, ...defaultProps });
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
