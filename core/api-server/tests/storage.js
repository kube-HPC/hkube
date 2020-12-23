const { expect } = require('chai');
const querystring = require('querystring');
const storageManager = require('@hkube/storage-manager');
const HttpStatus = require('http-status-codes');
const { Encoding } = require('@hkube/encoding');
const { request } = require('./utils');
const { uid: uuid } = require('@hkube/uid');
const { workerStub } = require('./mocks');
let restUrl;
let maxStorageFetchKeys;
let encoding;

describe('Storage', () => {
    before(async () => {
        restUrl = global.testParams.restUrl;
        maxStorageFetchKeys = global.testParams.config.maxStorageFetchKeys;
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
            expect(response.body.type).to.equal(global.testParams.config.defaultStorage);
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
            expect(response.body.keys).to.have.lengthOf(0);
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
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
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
        it('should not return specific keys', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
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
            expect(response.body.keys).to.have.lengthOf(0);
        });
        it('should limit the return to max keys', async () => {
            const length = 140;
            const jobId = `job-${uuid()}`;
            const options = {
                uri: `${restPath}/local-hkube`,
                method: 'GET'
            };
            const array = Array.from({ length }, (v, k) => k + 0);
            await Promise.all(array.map(a => storageManager.hkube.put({ jobId, taskId: `task-${a}`, data: `data-${a}` })));

            const response = await request(options);
            expect(response.body.keys).to.have.lengthOf(maxStorageFetchKeys);
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
            expect(response.body.name).to.be.undefined;
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
        it('should return specific stream', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
        });
    });
    describe('/stream/custom:path', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/stream/custom`;
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
        it('should stream with custom encode: false and value: null', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = null;
            const encoded = encoding.encode(data).toString();
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: false } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(encoded);
        });
        it('should stream with custom encode: false and value: object', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = { mydata: 'myData' };
            const encoded = encoding.encode(data).toString();
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: false } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(encoded);
        });
        it('should stream with custom encode: true and value: null', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = null;
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data);
        });
        it('should stream with custom encode: true and value: buffer', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = Buffer.alloc(10, 0xdd)
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data.toString('utf-8'));
        });
        it('should stream with custom encode: true and value: object', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = new Array(100).fill({ mydata: 'myData', myProp: 'myProp', value: "newstrvalue" });
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.eql(data);
        });
        it('should stream with custom encode: flase and value: buffer', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = Buffer.alloc(10, '0xdd')
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { ignoreEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data.toString('utf-8'));
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
        it('should return specific download', async () => {
            const alg = 'eval-alg';
            const options = {
                uri: `${restPath}/${`local-hkube-store/algorithm/${alg}.json`}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
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
            expect(response.body.error.message).to.equal(`stream ${value} Not Found`);
        });
        it('should download with file extension', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = null;
            const encoded = encoding.encode(data).toString();
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: false } });
            const options = {
                uri: `${restPath}/${result.path}?ext=jpg`,
                method: 'GET'
            };
            const res = await request(options);
            const content = res.response.headers['content-disposition'];
            const [, file] = content.split(';');
            const [, fileName] = file.split('=');
            expect(fileName).to.equal('hkube-result.jpg');
            expect(res.body).to.equal(encoded);
        });
        it('should download with custom encode: true and value: null', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = null;
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data);
        });
        it('should download with custom encode: false and value: null', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = null;
            const encoded = encoding.encode(data).toString();
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: false } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(encoded);
        });
        it('should download with custom encode: true and value: buffer', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = Buffer.alloc(10, '0xdd')
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { customEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data.toString('utf-8'));
        });
        it('should download with custom encode: false and value: buffer', async () => {
            const jobId = `jobId-${uuid()}`;
            const taskId = `taskId-${uuid()}`;
            const data = Buffer.alloc(10, '0xdd')
            const path = storageManager.hkube.createPath({ jobId, taskId });
            const result = await storageManager.storage.put({ path, data, encodeOptions: { ignoreEncode: true } });
            const options = {
                uri: `${restPath}/${result.path}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.equal(data.toString('utf-8'));
        });
    });
    describe('/download/pipeline/result/:jobId', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/storage/download/pipeline/result`;
        });
        it('should succeed to get download results', async () => {
            const optionsRun = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'exec_raw_results',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const responseRun = await request(optionsRun);
            const jobId = responseRun.body.jobId;
            const path1 = await storageManager.hkube.put({ jobId, taskId: 'a', data: 100 });
            const path2 = await storageManager.hkube.put({ jobId, taskId: 'b', data: 200 });
            const data = [
                {
                    nodeName: 'A',
                    algorithmName: 'yellow-alg',
                    info: {
                        path: path1.path,
                        size: 10
                    }
                },
                {
                    nodeName: 'B',
                    algorithmName: 'black-alg',
                    info: {
                        path: path2.path,
                        size: 20
                    }
                }];

            await workerStub.done({ jobId, data });
            const options = {
                uri: `${restPath}/${responseRun.body.jobId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.response.headers['content-disposition']).to.eql('attachment; filename=hkube-result.zip');
            expect(response.body).to.contains('metadata.json');
            expect(response.body).to.contains('jpg');
            expect(response.body).to.contains('png');
        });
    });
});
