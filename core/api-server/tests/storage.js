const { expect } = require('chai');
const querystring = require('querystring');
const storageManager = require('@hkube/storage-manager');
const HttpStatus = require('http-status-codes');
const { Encoding } = require('@hkube/encoding');
const { uuid } = require('../lib/utils');
const { request } = require('./utils');
let restUrl;
let encoding;

describe('Storage', () => {
    before(async () => {
        restUrl = global.testParams.restUrl;
        const config = global.testParams.config;
        const storage = config.storageAdapters[config.defaultStorage]
        encoding = new Encoding({ type: storage.encoding })
    });
    describe('/info', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/info`;
        });
        it('should success to get info', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.storage).to.equal(global.testParams.config.defaultStorage);
        });
    });
    describe('/prefix/types', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/prefix/types`;
        });
        it('should success get last five graph batch by batchIndex', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.eql(storageManager.prefixesTypes);
        });
    });
    describe('/prefixes/:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/prefixes`;
        });
        it('should throw prefix Not Found', async () => {
            const options = {
                uri: restPath + '/no_such_prefix',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('prefix no_such_prefix Not Found');
        });
        it('should return two prefixes', async () => {
            const options = {
                uri: `${restPath}/${storageManager.prefixesTypes.find(p => p === 'local-hkube-store')}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('keys');
            expect(response.body).to.have.property('path');
            expect(response.body).to.have.property('total');
            expect(response.body.keys).to.be.an('array').that.includes('algorithm');
        });
        it('should return zero prefixes', async () => {
            const options = {
                uri: `${restPath}/${storageManager.prefixesTypes.find(p => p === 'local-hkube-metadata')}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.keys).to.have.lengthOf(0);
        });
        it('should return all prefixes', async () => {
            const qs = querystring.stringify({ sort: 'no_such_id', order: 'asc', from: 0, to: 3 });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.lengthOf(storageManager.prefixesTypes.length);
        });
        it('should return all prefixes by path', async () => {
            const total = 3;
            const qs = querystring.stringify({ order: 'asc', from: 0, to: total });
            const options = {
                uri: `${restPath}/local-hkube-store/algorithm?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('keys');
            expect(response.body).to.have.property('path');
            expect(response.body).to.have.property('total');
            expect(response.body.keys).to.have.lengthOf(total);
        });
    });
    describe('/keys/:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/keys`;
        });
        it('should throw key Not Found', async () => {
            const options = {
                uri: restPath + '/no_such_key',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('key no_such_key Not Found');
        });
        it('should return specific keys', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            const algorithm = response.body.keys[0]
            expect(algorithm).to.have.property('path');
            expect(algorithm).to.have.property('size');
            expect(algorithm).to.have.property('mtime');
        });
        it('should return zero keys', async () => {
            const options = {
                uri: `${restPath}/local-hkube-metadata`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.keys).to.have.lengthOf(0);
        });
        it('should return all keys', async () => {
            const options = {
                uri: `${restPath}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.lengthOf(storageManager.prefixesTypes.length);
        });
        it('should return all keys by query', async () => {
            const total = 3;
            const qs = querystring.stringify({ sort: 'size', order: 'desc', from: 0, to: total });
            const options = {
                uri: `${restPath}/local-hkube-store?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.keys).to.have.lengthOf(total);
        });
    });
    describe('/values/:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/values`;
        });
        it('should throw value Not Found', async () => {
            const value = 'local-hkube-store/algorithm/no_such_value';
            const options = {
                uri: `${restPath}/${value}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`value ${value} Not Found`);
        });
        it('should return specific value', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.name).to.eql(alg);
        });
    });
    describe('/stream/:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/stream`;
        });
        it('should throw stream Not Found', async () => {
            const value = 'local-hkube-store/algorithm/no_such_stream';
            const options = {
                uri: `${restPath}/${value}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`stream ${value} Not Found`);
        });
        it.skip('should return specific stream', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            const body = encoding.decode(response.body);
            expect(body.name).to.eql(alg);
        });
    });
    describe('/download/:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/download`;
        });
        it('should throw key Not Found', async () => {
            const value = 'local-hkube-store/algorithm/no_such_stream';
            const options = {
                uri: `${restPath}/${value}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`stream ${value} Not Found`);
        });
        it.skip('should return specific download', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.name).to.eql(alg);
        });
    });
    describe('/download/custom/:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/download/custom`;
        });
        it('should throw key Not Found', async () => {
            const value = 'local-hkube-store/algorithm/no_such_stream';
            const options = {
                uri: `${restPath}/${value}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`value ${value} Not Found`);
        });
        it.skip('should return specific download data', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = { prop: "hello" };
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data }, null, { customEncode: true });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data);
        });
        it('should return specific download buffer', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = Buffer.alloc(10, '0xdd')
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data }, null, { customEncode: true });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data.toString('utf-8'));
        });
    });
});
