const { expect } = require('chai');
const fse = require('fs-extra');
const nock = require('nock');
const HttpStatus = require('http-status-codes');
const merge = require('lodash.merge');
const { uid: uuid } = require('@hkube/uid');
const stateManager = require('../lib/state/state-manager');
const versionsService = require('../lib/service/algorithm-versions');
const buildsService = require('../lib/service/builds');
const validationMessages = require('../lib/consts/validationMessages.js');
const { MESSAGES } = require('../lib/consts/builds');
const { algorithms } = require('./mocks');
const nodes = require('./mocks/nodes.json');
const { request, delay, defaultProps } = require('./utils');
const commit = require('./mocks/github-commit.json');
let restUrl, restPath, applyPath, versionsPath;

const baseApi = 'https://api.github.com';
const gitRepo = 'https://github.com/kube-HPC/hkube';
const hkubeRepo = '/repos/kube-HPC/hkube/commits';
const emptyGit = '/repos/hkube/empty/commits';
const fullGit = '/repos/hkube/my.git.foo.bar/commits';

describe('Store/Algorithms', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/store/algorithms`;
        applyPath = `${restPath}/apply`;
        versionsPath = `${restUrl}/versions/algorithms`;
        nock(baseApi).persist().get(emptyGit).query(true).reply(HttpStatus.StatusCodes.BAD_REQUEST, 'Git Repository is empty');
        nock(baseApi).persist().get(fullGit).query(true).reply(HttpStatus.StatusCodes.OK, commit.data);
        nock(baseApi).persist().get(hkubeRepo).query(true).reply(HttpStatus.StatusCodes.OK, commit.data);
    });

    describe('/store/algorithms:name GET', () => {
        it('should throw error algorithm not found', async () => {
            const options = {
                uri: `${restPath}/notexists`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm notexists Not Found');
        });

        it('should return specific algorithm', async () => {
            const body = { payload: JSON.stringify({
                name: 'test-alg',
                algorithmImage: 'hkube/algorithm-example',
                cpu: 1,
                mem: '5000Ki'
            }) };
            await request({ uri: restPath, body });
            const response = await request({ uri: `${restPath}/test-alg`, method: 'GET' });
            const { version, created, modified, reservedMemory,auditTrail, ...algorithm } = response.body;
            expect(algorithm).to.eql({ ...defaultProps, ...JSON.parse(body.payload) });
        });
    });

    describe('/store/algorithms:name DELETE', () => {
        it('should throw error algorithm not found', async () => {
            const algorithmName = `delete-${uuid()}`;
            const options = {
                uri: `${restPath}/${algorithmName}`,
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal(`algorithm ${algorithmName} Not Found`);
        });

        it('should throw error on related data', async () => {
            const algorithmName = `alg-${uuid()}`;
            const pipelineName = `pipe-${uuid()}`;
            const algorithm = {
                uri: restPath,
                body: { payload: JSON.stringify({
                    name: algorithmName,
                    algorithmImage: 'image'
                }) }
            };
            const store = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: pipelineName,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName,
                            input: []
                        }
                    ]
                }
            };
            const exec = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: store.body.name
                }
            };

            const resAlg = await request(algorithm);
            await request(store);
            const execRes = await request(exec);
            const jobId = execRes.body.jobId;
            await versionsService.createVersion(resAlg.body);
            await stateManager.createBuild({ buildId: `${algorithmName}-1`, algorithmName });
            await stateManager.createBuild({ buildId: `${algorithmName}-2`, algorithmName });

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=false`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`algorithm ${algorithmName} is stored in 1 pipelines (${pipelineName}), 1 executions (${jobId}). you must first delete all related data or use the force flag`);
        });

        it('should delete algorithm with related data with force', async () => {
            const algorithmName = `my-alg-${uuid()}`;
            const formData = {
                payload: JSON.stringify({ name: algorithmName, env: 'nodejs' }),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const resApply = await request({ uri: `${restPath}/apply`, formData });
            const storePipeline = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: `delete-${uuid()}`,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName,
                            input: []
                        }
                    ]
                }
            };
            const execPipeline = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: storePipeline.body.name
                }
            };

            await request(storePipeline);
            await request(execPipeline);
            await versionsService.createVersion(resApply.body.algorithm);

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=true`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('related data deleted');
        });

        it('should delete algorithm with related data without force', async () => {
            const algorithmName = `delete-${uuid()}`;
            const algorithm = {
                uri: restPath,
                body: { payload: JSON.stringify({
                    name: algorithmName,
                    algorithmImage: 'image'
                }) }
            };
            const resAlg = await request(algorithm);
            await versionsService.createVersion(resAlg.body.algorithm);
            await buildsService.startBuild({ buildId: `${algorithmName}-1`, algorithmName });
            await buildsService.startBuild({ buildId: `${algorithmName}-2`, algorithmName });

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=false&keepOldVersions=false`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.equal(`algorithm ${algorithmName} successfully deleted from store. related data deleted: 2 builds, 2 versions`);
        });

        it('should delete specific algorithm without related data', async () => {
            const optionsInsert = {
                uri: restPath,
                body: { payload: JSON.stringify({
                    name: 'delete',
                    algorithmImage: 'image'
                })}
            };
            await request(optionsInsert);

            const options = {
                uri: restPath + '/delete?force=true',
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('successfully deleted from store');
        });
    });

    describe('/store/algorithms GET', () => {
        it('should success to get list of algorithms', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.be.an('array');
        });
    });

    describe('/store/algorithms POST', () => {
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: { payload: "{}" }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });

        it('should throw validation error of long algorithm name', async () => {
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify({ name: 'this-is-33-length-algorithm--name' }) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should NOT be longer than 32 characters');
        });

        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify({ name: {} }) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should be string');
        });

        it('should throw validation error of memory min 4 Mi', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                mem: '3900Ki',
                cpu: 1
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
        });

        it('should throw conflict error', async () => {
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify({
                        name: 'conflict',
                        algorithmImage: 'image'
                    })
                }
            };
            await request(options);
            const response = await request(options);
            expect(response.response.statusCode).to.equal(409);
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.equal('algorithm conflict already exists');
        });

        const invalidChars = ['/', '_', '*', '#', '"', '%', 'A'];
        invalidChars.forEach((v) => {
            it(`should throw invalid algorithm name if include ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: { payload: JSON.stringify({
                        name: `notvalid${v}name`,
                        algorithmImage: 'image'
                    }) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_NAME_FORMAT);
            });
        });

        const invalidStartAndEndChars = ['/', '_', '*', '#', '"', '%', '-', 'A'];
        invalidStartAndEndChars.forEach((v) => {
            it(`should throw invalid if algorithm name if start with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: { payload: JSON.stringify({
                        name: `${v}notvalidname`,
                        algorithmImage: 'image'
                    }) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_NAME_FORMAT);
            });

            it(`should throw invalid if algorithm name if end with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: { payload: JSON.stringify({
                        name: `notvalidname${v}`,
                        algorithmImage: 'image'
                    }) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_NAME_FORMAT);
            });
        });

        it('should failed to store algorithm with no name', async () => {
            const body = { payload: "{}" };
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });

        it('should failed to store algorithm with no image', async () => {
            const body = { payload: JSON.stringify({
                name: uuid()
            }) };
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('cannot apply algorithm due to missing image url or build data');
        });

        it('should failed to store algorithm with end whitespace image name', async () => {
            const body = { payload: JSON.stringify({
                name: uuid(),
                algorithmImage: 'image '
            }) };
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_IMAGE_FORMAT);
        });

        it('should failed to store algorithm with start whitespace image name', async () => {
            const body = { payload: JSON.stringify({
                name: uuid(),
                algorithmImage: ' image'
            }) };
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_IMAGE_FORMAT);
        });

        it('should failed to store algorithm with middle whitespace image name', async () => {
            const body = { payload: JSON.stringify({
                name: uuid(),
                algorithmImage: 'image name'
            }) };
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_IMAGE_FORMAT);
        });
    
        it('should succeed to store algorithm with name of 32 characters', async () => {
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify({
                    name: `this-is-32-length-algorithm-${uuid()}`,
                    algorithmImage: 'image-name'
                }) }
            };
            const response = await request(options);
            const { version, created, modified, reservedMemory, auditTrail, ...algorithm } = response.body.algorithm;
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(algorithm).to.eql({ ...defaultProps, ...JSON.parse(options.body.payload) });
        });

        it('should succeed to store algorithm name (www.example.com)', async () => {
            const body = { payload: JSON.stringify({
                name: '2-www.exam-ple.com' + uuid(),
                algorithmImage: 'image',
                mem: '50Mi',
                cpu: 1
            }) };
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            const { version, created, modified, reservedMemory, auditTrail, ...algorithm } = response.body.algorithm;
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(algorithm).to.eql({ ...defaultProps, ...JSON.parse(body.payload) });
        });

        it('should succeed to parallel store and get multiple algorithms', async function () {
            const limit = 3;
            const total = 5;
            const keys = Array.from(Array(total).keys());
            const algorithms = keys.map((k) => ({
                ...defaultProps,
                name: `stress-${k}-${uuid()}`,
                algorithmImage: 'image',
                mem: '50Mi',
                cpu: k
            }));
            const result = await Promise.all(algorithms.map((a) => request({ uri: restPath, body: { payload: JSON.stringify(a) }})));
            result.forEach((r, i) => {
                const { version, created, modified, reservedMemory, auditTrail, ...algorithm } = r.body.algorithm;
                expect(algorithm).to.eql(algorithms[i]);
            });
            const options = {
                uri: `${restPath}?name=stress&limit=${limit}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.has.lengthOf(limit);
        });

        it('should succeed to store algorithm', async () => {
            const body = { payload: JSON.stringify({
                name: uuid(),
                algorithmImage: 'image',
                mem: '50Mi',
                cpu: 1,
                type: 'Image'
            }) };
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            const { version, created, modified, reservedMemory, auditTrail, ...algorithm } = response.body.algorithm;
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(algorithm).to.eql({ ...defaultProps, ...JSON.parse(body.payload) });
        });

        it('should succeed to store algorithm with devMode', async () => {
            const body = { payload: JSON.stringify({
                name: uuid(),
                algorithmImage: 'image',
                mem: '50Mi',
                cpu: 1,
                type: 'Image',
                options: {
                    devMode: true
                }
            }) };
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            const { version, created, modified, reservedMemory, auditTrail, ...algorithm } = response.body.algorithm;
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(algorithm).to.eql(merge({}, defaultProps, JSON.parse(body.payload)));
        });

        it('should secceed to create algorithms when provided with an array of valid data', async () => {
            const algos = [
                {
                    name: uuid(),
                    algorithmImage: 'image',
                    mem: '50Mi',
                    cpu: 1,
                    type: 'Image',
                },
                {
                    name: uuid(),
                    algorithmImage: 'image',
                    mem: '50Mi',
                    cpu: 1,
                    type: 'Image',
                },
            ];
            const options = {
                uri: restPath,
                body: { payload: algos.map(alg => JSON.stringify(alg)) }
            };

            const response = await request(options);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(algos.length);
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
        });

        it('should succeed creating an array containing a 409 Conflict status and error message for existing algorithms', async () => {
            const existingAlgorithm = {
                name: 'existing-algorithm',
                algorithmImage: 'image',
                mem: '50Mi',
                cpu: 1,
                type: 'Image',
            }
            const existingAlgOption = {
                uri: restPath,
                body: { payload: JSON.stringify(existingAlgorithm) }
            };
            await request(existingAlgOption)

            const algorithmsList = [
                {
                    ...existingAlgorithm
                },
                {
                    name: uuid(),
                    algorithmImage: 'image',
                    mem: '50Mi',
                    cpu: 1,
                    type: 'Image',
                },
            ];

            const algorithmData = {
                uri: restPath,
                body: { payload: algorithmsList.map(alg => JSON.stringify(alg)) }
            }

            const response = await request(algorithmData)
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(algorithmsList.length);
            expect(response.body[1].error).to.not.exist;
            expect(response.body[0].error.code).to.equal(HttpStatus.StatusCodes.CONFLICT)
            expect(response.body[0].error.message).to.include('algorithm existing-algorithm already exists');
        });

        it('should succeed to overwrith existing algorithms', async () => {
            const existingAlgorithm = {
                name: 'existing-algorithm2',
                algorithmImage: 'image',
                mem: '50Mi',
                cpu: 1,
                type: 'Image',
            }
            const existingAlgOption = {
                uri: restPath,
                body: { payload: JSON.stringify(existingAlgorithm) }
            };
            await request(existingAlgOption)
            existingAlgorithm.mem = '40Mi'
            const algorithmsList = [
                {
                    ...existingAlgorithm
                },
                {
                    name: uuid(),
                    algorithmImage: 'image',
                    mem: '50Mi',
                    cpu: 1,
                    type: 'Image',
                },
            ];

            const algorithmData = {
                uri: restPath,
                body: { 
                    payload: algorithmsList.map(alg => JSON.stringify(alg)),
                    options: JSON.stringify({ allowOverwrite: true })
                }
            }

            const response = await request(algorithmData)
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(algorithmsList.length);
            expect(response.body[1].error).to.not.exist;

            const optionsGet = {
                uri: `${restPath}/existing-algorithm2`,
                method: 'GET'
            };
            const alg = await request(optionsGet);
            expect(alg.body.mem).to.eq('40Mi');
        });

        it('should secceed creating an array containing a 400 Bad Request status and error message for invalid data', async () => {
            // Define some algorithm data objects, including one with invalid data
            const invalidAlgorithmData = [
                {
                    name: 'Invalid Algorithm NAME-',
                    algorithmImage: 'image',
                    mem: '50Mi',
                    cpu: 1,
                    type: 'Image',
                },
                {
                    name: 'valid-algorithm-name',
                    algorithmImage: 'image',
                    mem: '50Mi',
                    cpu: 1,
                    type: 'Image',
                },
            ];

            const algorithmData = {
                uri: restPath,
                body: { payload: invalidAlgorithmData.map(alg => JSON.stringify(alg)) }
            }

            const response = await request(algorithmData)
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(invalidAlgorithmData.length);
            expect(response.body[1].error).to.not.exist;
            expect(response.body[0].error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST)
            expect(response.body[0].error.name).to.equal('Invalid Algorithm NAME-')
            expect(response.body[0].error.message).to.include('algorithm name must contain only lower-case alphanumeric, dash or dot');
        });

        it('should return a 201 Created status and an empty array for an empty request body', async () => {
            const emptyData = {
                uri: restPath,
                body: { payload: [] }
            }

            const response = await request(emptyData)
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(0);
        });

        it('should throw invalid of workerCustomResources for limits cpu missing', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                workerCustomResources: {
                    requests: { cpu: '0.1', memory: '200Mi' },
                    limits: { memory: '300Mi' }
                }
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('algorithm has invalid workerCustomResources: limits.cpu must be defined');
        });

        it('should throw invalid of workerCustomResources for requests cpu missing', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                workerCustomResources: {
                    requests: {  memory: '200Mi' },
                    limits: {cpu: '0.1',memory: '300Mi' }
                }
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('algorithm has invalid workerCustomResources: requests.cpu must be defined');
        });

        it('should throw invalid of workerCustomResources for requests memory missing', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                workerCustomResources: {
                    requests: {  cpu: '0.1' },
                    limits: {cpu: '0.1',memory: '300Mi' }
                }
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('algorithm has invalid workerCustomResources: requests.memory must be defined');
        });

        it('should throw invalid of workerCustomResources for limits memory missing', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                workerCustomResources: {
                    requests: {  cpu: '0.1',memory: '300Mi' },
                    limits: {cpu: '0.2' }
                }
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('algorithm has invalid workerCustomResources: limits.memory must be defined');
        });

        it('should throw invalid of workerCustomResources for both cpu and memory', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                workerCustomResources: {
                    requests: {  },
                    limits: { cpu: '0.1', memory: '300Mi' }
                }
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('algorithm has invalid workerCustomResources: requests.memory must be defined, requests.cpu must be defined');
        });

        it('should succeed with workerCustomResources for both cpu and memory', async () => {
            const algo = {
                name: uuid(),
                algorithmImage: 'image',
                workerCustomResources: {
                    requests: { cpu: '0.1', memory: '300Mi'  },
                    limits: { cpu: '0.2', memory: '400Mi' }
                }
            };
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(algo) }

            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.CREATED);
            expect(response.body.algorithm.workerCustomResources.limits.memory).to.to.equal('400Mi');
        });
    });

    describe('/store/algorithms/apply POST', () => {
        describe('Validation', () => {
            before(async () => {
                stateManager._etcd.discovery._client.leaser._lease = null;
                await stateManager._etcd.discovery.register({ serviceName: 'task-executor', data: nodes });
            });

            it('should throw validation error of required property name', async () => {
                const options = {
                    uri: applyPath,
                    formData: {}
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('algorithm should have required property "name"');
            });

            it('should throw validation error of data.name should be string', async () => {
                const payload = JSON.stringify({ name: {} });
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should be string');
            });

            it('should throw validation error of memory min 4 Mi', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'image',
                    mem: '3900Ki',
                    cpu: 1
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
            });

            it('should throw validation error of invalid reservedMemory', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'image',
                    reservedMemory: 300
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('memory unit must be one of Ki,M,Mi,Gi,m,K,G,T,Ti');
            });

            it('should throw validation invalid env', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'image',
                    mem: '3900Ki',
                    cpu: 1,
                    env: 'no_such'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.contain('data.env should be equal to one of the allowed values');
            });

            it('should throw validation invalid fileExt', async () => {
                const payload = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1
                };
                const formData = {
                    payload: JSON.stringify(payload),
                    file: fse.createReadStream('tests/mocks/algorithm.tar')
                };
                const options = {
                    uri: applyPath,

                    formData
                };
                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.contain('data.fileExt should be equal to one of the allowed values');
            });

            it('should throw error of missing image and file', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1
                };
                const formData = {
                    payload: JSON.stringify(body)
                };
                const options = {
                    uri: applyPath,
                    formData
                };

                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal(MESSAGES.APPLY_ERROR);
            });

            it('should not throw error when git repo was not supplied', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    type: 'Git',
                    mem: '50Mi',
                    cpu: 1
                };
                const uri = applyPath;
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req);
                expect(res.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
                expect(res.body).to.not.have.property('buildId');
            });

            it('should not throw error when file was not supplied', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    type: 'Code',
                    mem: '50Mi',
                    cpu: 1
                };
                const uri = applyPath;
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req);
                expect(res.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
                expect(res.body).to.not.have.property('buildId');
            });

            it('should throw validation error of algorithm type cannot be changed', async () => {
                const url = 'https://github.com/hkube/my.git.foo.bar';
                const body1 = {
                    name: uuid(),
                    gitRepository: {
                        url
                    },
                    env: 'nodejs',
                    type: 'Git'
                };
                const body2 = {
                    ...body1,
                    type: 'Code'
                };
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body1) }
                };
                const options2 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body2) }
                };
                const res1 = await request(options1);
                const res2 = await request(options2);
                expect(res1.body).to.have.property('buildId');
                expect(res2.body).to.have.property('error');
                expect(res2.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res2.body.error.message).to.contain(`algorithm type cannot be changed from "${body1.type}" to "${body2.type}"`);
            });

            it('should throw validation error of maximum cpu capacity exceeded', async () => {
                const body = {
                    name: uuid(),
                    cpu: 20,
                    mem: '2Gi',
                    gpu: 0
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.eql(`maximum capacity exceeded cpu(node1: 15, node2: 16, node3: 17, node4: 18)`);
            });

            it('should throw validation error of maximum mem capacity exceeded', async () => {
                const body = {
                    name: uuid(),
                    cpu: 1,
                    mem: '80Gi',
                    gpu: 0
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.eql(`maximum capacity exceeded mem(node1: 40805, node2: 50805, node3: 60805, node4: 70805)`);
            });

            it('should throw validation error of maximum capacity exceeded all', async () => {
                const body = {
                    name: uuid(),
                    cpu: 50,
                    mem: '80Gi',
                    gpu: 15
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.eql(`maximum capacity exceeded cpu(node1: 15, node2: 16, node3: 17, node4: 18), mem(node1: 40805, node2: 50805, node3: 60805, node4: 70805), gpu(node1: 0, node2: 1, node3: 2, node4: 3)`);
            });

            it('should delete nullable properties', async () => {
                const algorithmName = uuid();
                const body1 = {
                    name: algorithmName,
                    algorithmImage: 'algorithmImage',
                    baseImage: 'hkube/image',
                    algorithmEnv: {
                        MY_ENV: 'value'
                    },
                    workerEnv: {
                        MY_ENV: 'value'
                    },
                    quotaGuarantee: 5,
                    labels: {
                        'hkube.io/key': 'label'
                    },
                    downloadFileExt: 'jpg',
                    annotations: {
                        'hkube.io/key': 'annotation'
                    },
                    nodeSelector: {
                        'hkube.io/key': 'selector'
                    }
                };
                const body2 = {
                    name: algorithmName,
                    baseImage: null,
                    algorithmEnv: null,
                    workerEnv: null,
                    quotaGuarantee: null,
                    labels: null,
                    annotations: null,
                    downloadFileExt: null,
                    nodeSelector: null
                };
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body1) }
                };
                const options2 = {
                    uri: applyPath,
                    body: {
                        payload: JSON.stringify(body2),
                        options: JSON.stringify({ forceUpdate: false }),
                    }
                };
                await request(options1);
                const res = await request(options2);

                const version = res.body.algorithm.version;
                const versionReq = {
                    uri: `${restUrl}/versions/algorithms/apply`,
                    body: { version, name: algorithmName, force: true }
                };
                await request(versionReq);

                const getOptions = {
                    uri: `${restPath}/${algorithmName}`,
                    method: 'GET'
                };
                const response = await request(getOptions);
                expect(response.body).to.not.have.property('baseImage');
                expect(response.body).to.not.have.property('algorithmEnv');
                expect(response.body).to.not.have.property('workerEnv');
                expect(response.body).to.not.have.property('quotaGuarantee');
                expect(response.body).to.not.have.property('labels');
                expect(response.body).to.not.have.property('annotations');
                expect(response.body).to.not.have.property('downloadFileExt');
                expect(response.body).to.not.have.property('nodeSelector');
            });

            it('should throw validation error if sidecar container names are not unique', async () => {
                const url = 'https://github.com/hkube/my.git.foo.bar';
                const body = {
                    name: uuid(),
                    gitRepository: {
                        url
                    },
                    env: 'nodejs',
                    type: 'Git',
                    sideCars: [
                        {
                            container: {
                                name: 'my-container-1',
                                image: 'nginx'
                            }
                        },
                        {
                            container: {
                                name: 'my-container-1',
                                image: 'redis'
                            }
                        }
                    ]
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.contain('Sidecar container names must be unique!');
            });
        });

        describe('labels and annotations', () => {
            it('should throw validation error of invalid labels key', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    labels: {
                        '': 'value'
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('labels key must be a valid string');
            });

            it('should not throw validation error if empty label value', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    labels: {
                        key: ''
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.not.have.property('error');
            });

            it('should throw validation error of empty label name', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    labels: {
                        'hkube.do-main.com/': 'my-val'
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('labels key name must be a valid string');
            });

            it('should throw validation error if invalid label key name', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    labels: {
                        'hkube.do-main.com/NOT_VALID': 'my-value'
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.contains('labels key name must beginning and ending with an alphanumeric character with dashes');
            });

            it('should not throw validation error if empty label value', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    labels: {
                        'hkube.do-main.com/valid': ''
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.not.have.property('error');
            });

            it('should throw validation error if whitespace label value', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    labels: {
                        'hkube.do-main.com/valid': ' my val '
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.contains('labels value must beginning and ending with an alphanumeric character with dashes');
            });

            it('should throw validation error of invalid annotation key', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    annotations: {
                        '': 'value'
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('annotations key must be a valid string');
            });

            it('should not throw validation error if empty annotation value', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    annotations: {
                        key: ''
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.not.have.property('error');
            });

            it('should throw validation error of empty annotation name', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    annotations: {
                        'hkube.do-main.com/': ' '
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.equal('annotations key name must be a valid string');
            });

            it('should throw validation error if invalid annotation key name', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    annotations: {
                        'hkube.do-main.com/NOT_VALID': ' '
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(response.body.error.message).to.contains('annotations key name must beginning and ending with an alphanumeric character with dashes');
            });

            it('should not throw validation error if empty annotation value', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: 'algorithmImage',
                    annotations: {
                        'hkube.do-main.com/valid': ''
                    }
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const response = await request(options);
                expect(response.body).to.not.have.property('error');
            });
        });

        describe('GitHub', () => {
            it('should throw error of required property url', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {},
                    type: 'Git'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`data.gitRepository should have required property 'url'`);
            });

            it('should throw error of match format url', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url: ''
                    },
                    type: 'Git'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`data.gitRepository.url should match format "url"`);
            });

            it('should throw error of url not found', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url: 'http://no_such_url'
                    },
                    type: 'Git'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`invalid url 'http://no_such_url'`);
            });

            it('should throw error of branch not found', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url: 'http://no_such_url',
                        branchName: 'no_such'
                    },
                    type: 'Git'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`invalid url 'http://no_such_url'`);
            });

            it('should throw error of git repository is empty', async () => {
                const url = 'https://github.com/hkube/empty';
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url
                    },
                    type: 'Git'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`Git Repository is empty (${url})`);
            });

            it('should apply twice and create one build', async () => {
                const url = 'https://github.com/hkube/my.git.foo.bar';
                const name = uuid();
                const algorithm = {
                    name,
                    gitRepository: {
                        url,
                        token: '1111',
                        gitKind: 'github',
                        commit: {
                            id: uuid()
                        }
                    },
                    env: 'nodejs',
                    baseImage: 'my-new-base/image',
                    type: 'Git'
                };
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(algorithm) }
                };
                const res1 = await request(options1);

                const options2 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(res1.body.algorithm) }
                };
                const res2 = await request(options2);

                expect(res1.body).to.have.property('buildId');
                expect(res2.body).to.not.have.property('buildId');
            });

            it('should create build with last commit data', async () => {
                const name = uuid();
                const body = {
                    name,
                    mem: '6000Mi',
                    cpu: 1,
                    gitRepository: {
                        url: gitRepo
                    },
                    env: 'nodejs'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });

            it('should not trigger new build if same commit id', async () => {
                const body = {
                    name: uuid(),
                    gitRepository: {
                        url: gitRepo
                    },
                    env: 'nodejs'
                };
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res1 = await request(options);
                expect(res1.body).to.have.property('buildId');

                const res2 = await request(options);
                expect(res2.body).to.not.have.property('buildId');
            });

            it('should succeed to apply with build due to change in baseImage', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    env: 'nodejs',
                    gitRepository: {
                        url: gitRepo
                    },
                    baseImage: 'python:2.7'
                };
                const body2 = {
                    name: body1.name,
                    baseImage: 'python:3.7'
                };
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body1) }
                };
                const options2 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body2) }
                };
                const response1 = await request(options1);
                const response2 = await request(options2);
                expect(response1.body).to.have.property('buildId');
                expect(response2.body).to.have.property('buildId');
            });

            it.skip('should create build from private repo', async () => {
                const url = 'https://github.com/NassiHarel/build-git';
                const name = uuid();
                const algorithm = {
                    name,
                    gitRepository: {
                        url,
                        token: '1234',
                        gitKind: 'github'
                    },
                    env: 'python',
                    type: 'Git'
                };
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(algorithm) }
                };
                const res1 = await request(options1);
                expect(res1.body).to.have.property('buildId');
            });
        });

        describe('Code', () => {
            it('should succeed to apply algorithm with no changes', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'hkube/image',
                    env: 'nodejs'
                };
                const body2 = {
                    ...body1
                };
                const uri = applyPath;
                const options1 = { uri, formData: { payload: JSON.stringify(body1), file: '' } };
                const options2 = { uri, formData: { payload: JSON.stringify(body2), file: '' } };
                const response1 = await request(options1);
                const response2 = await request(options2);
                expect(response1.body.algorithm).to.eql(response2.body.algorithm);
            });

            it('should succeed to apply algorithm with first build', async () => {
                const payload = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1,
                    env: 'nodejs'
                };
                const formData = {
                    payload: JSON.stringify(payload),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const options = {
                    uri: applyPath,
                    formData
                };
                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
                expect(response.body).to.have.property('buildId');
                expect(response.body).to.have.property('messages');
                expect(response.body.messages[0]).to.equal(MESSAGES.FIRST_BUILD);

                const getOptions = {
                    uri: restPath + '/' + payload.name,
                    method: 'GET'
                };
                const algResponse = await request(getOptions);
                expect(algResponse.body.fileInfo).to.have.property('fileExt');
                expect(algResponse.body.fileInfo).to.have.property('checksum');
                expect(algResponse.body.fileInfo).to.have.property('fileSize');
            });

            it('should succeed to apply algorithm without buildId in response', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1
                };
                const body1 = {
                    ...body,
                    env: 'nodejs'
                };
                const body2 = {
                    ...body,
                    env: 'nodejs',
                    cpu: 2
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = applyPath;
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                await request(options1);
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
                expect(response.body).to.not.have.property('buildId');
                expect(response.body.messages[0]).to.equal(MESSAGES.NO_TRIGGER_FOR_BUILD);
            });

            it('should succeed to apply algorithm without changing old data', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1
                };
                const body1 = {
                    ...body,
                    env: 'nodejs',
                    entryPoint: 'main.py',
                    cpu: 1
                };
                const body2 = {
                    ...body,
                    env: 'python',
                    entryPoint: 'app.py',
                    cpu: 2
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const options1 = {
                    uri: applyPath,
                    formData: formData1
                };
                const options2 = {
                    uri: applyPath,
                    formData: formData2
                };
                const res1 = await request(options1);
                const res2 = await request(options2);
                const optionsGet = {
                    uri: `${restPath}/${body.name}`,
                    method: 'GET'
                };
                const alg = await request(optionsGet);
                expect(alg.body.cpu).to.eql(body1.cpu);
                expect(alg.body.entryPoint).to.eql(body1.entryPoint);
                expect(res1.body).to.have.property('buildId');
                expect(res2.body).to.have.property('buildId');

                expect(res1.body.messages).to.have.lengthOf(2);
                expect(res2.body.messages).to.have.lengthOf(1);
            });

            it('should succeed to apply algorithm with buildId due to change in env', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1
                };
                const body1 = {
                    ...body,
                    env: 'nodejs',
                    type: 'Code'
                };
                const body2 = {
                    ...body,
                    env: 'python'
                };
                const options = {
                    uri: restPath,
                    body: body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = applyPath;
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                await request(options);
                await request(options1);

                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
                expect(response.body).to.have.property('buildId');
                expect(response.body.messages[0]).to.contains('a build was triggered due to change in env');
            });

            it('should succeed to apply algorithm with buildId due to change in checksum', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    env: 'python'
                };
                const body2 = {
                    ...body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.zip')
                };
                const uri = applyPath;
                const options1 = { uri, formData: formData1 };
                const options2 = { uri, formData: formData2 };
                const response1 = await request(options1);
                const response2 = await request(options2);
                expect(response1.body).to.have.property('buildId');
                expect(response2.body).to.have.property('buildId');
                expect(response2.body.messages[0]).to.contains('a build was triggered due to change in checksum');
            });

            it('should succeed to apply algorithm with buildId due to change in dependencyInstallCmd', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    env: 'python'
                };
                const body2 = {
                    ...body1,
                    dependencyInstallCmd: './foo'
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = applyPath;
                const options1 = { uri, formData: formData1 };
                const options2 = { uri, formData: formData2 };
                const response1 = await request(options1);
                const response2 = await request(options2);
                expect(response1.body).to.have.property('buildId');
                expect(response2.body).to.have.property('buildId');
                expect(response2.body.messages[0]).to.contains('a build was triggered due to change in dependencyInstallCmd');
            });

            it('should succeed to apply with build due to change in baseImage', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    env: 'nodejs',
                    baseImage: 'python:2.7'
                };
                const body2 = {
                    ...body1,
                    baseImage: 'python:3.7'
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2)
                };
                const uri = applyPath;
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };

                const response1 = await request(options1);
                const response2 = await request(options2);
                expect(response1.body).to.have.property('buildId');
                expect(response2.body).to.have.property('buildId');
            });

            it('should succeed to apply algorithm without buildId in response', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: '50Mi',
                    cpu: 1,
                    env: 'nodejs',
                    type: 'Code'
                };
                const body1 = {
                    ...body,
                    cpu: 1
                };
                const body2 = {
                    ...body,
                    cpu: 2
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2)
                };
                const uri = applyPath;
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                await request(options1);
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.OK);
                expect(response.body).to.not.have.property('buildId');
            });

            it('should succeed to apply algorithm with force build', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    env: 'nodejs'
                };
                const body2 = {
                    ...body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    options: JSON.stringify({ forceBuild: true })
                };
                const options1 = { uri: applyPath, formData: formData1 };
                const options2 = { uri: applyPath, formData: formData2 };
                const res1 = await request(options1);
                const res2 = await request(options2);
                expect(res1.body).to.have.property('buildId');
                expect(res2.body).to.have.property('buildId');
                expect(res1.body.messages[0]).to.eql(MESSAGES.FIRST_BUILD);
                expect(res2.body.messages[0]).to.eql(MESSAGES.FORCE_BUILD);
            });

            it('should succeed to watch completed build', async () => {
                const algorithmName = `my-alg-${uuid()}`;
                const algorithmImage = `${algorithmName}-image`;
                const formData = {
                    payload: JSON.stringify({ name: algorithmName, env: 'nodejs' }),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const res1 = await request({ uri: `${restPath}/apply`, formData });
                await stateManager.updateBuild({ buildId: res1.body.buildId, algorithmImage, status: 'completed' });
                await delay(2000);

                const { options, created: c1, modified: c2, reservedMemory: none,auditTrail, ...restProps } = res1.body.algorithm;
                const res2 = await request({ uri: `${versionsPath}/${algorithmName}`, method: 'GET' });
                const { version, created, modified, reservedMemory, auditTrail:auditTrail1 , ...algorithm } = res2.body[0].algorithm;
                expect(algorithm).to.eql({ ...defaultProps, ...restProps, algorithmImage });
            });

            it('should succeed to update algorithm only after completed build', async function () {
                const algorithmName = `new-build-${uuid()}`;
                const algorithmImage1 = `${algorithmName}-image1`;
                const algorithmImage2 = `${algorithmName}-image2`;
                const formData1 = {
                    payload: JSON.stringify({ name: algorithmName, cpu: 1, env: 'nodejs' }),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify({ name: algorithmName, cpu: 2, env: 'python' }),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const app1 = await request({ uri: `${restPath}/apply`, formData: formData1 });
                const get1 = await request({ uri: `${restPath}/${algorithmName}`, method: 'GET' });
                const app2 = await request({ uri: `${restPath}/apply`, formData: formData2 });
                const get2 = await request({ uri: `${restPath}/${algorithmName}`, method: 'GET' });

                await stateManager.updateBuild({ buildId: app1.body.buildId, algorithmImage: algorithmImage1, status: 'completed' });
                await delay(1000);

                const get3 = await request({ uri: `${restPath}/${algorithmName}`, method: 'GET' });
                app2.body.algorithm.version = get3.body.version;

                await stateManager.updateBuild({ buildId: app2.body.buildId, algorithmImage: algorithmImage2, status: 'completed' });
                await delay(1000);

                const get4 = await request({ uri: `${restPath}/${algorithmName}`, method: 'GET' });
                const versions = await request({ uri: `${versionsPath}/${algorithmName}`, method: 'GET' });

                expect(versions.body).to.have.lengthOf(2);
                expect(versions.body[0].algorithm.cpu).to.eql(2);
                expect(versions.body[1].algorithm.cpu).to.eql(1);

                expect(app1.body.messages).to.have.lengthOf(2);
                expect(app2.body.messages).to.have.lengthOf(1);
                expect(get1.body.cpu).to.eql(1);
                expect(get1.body.options.pending).to.eql(true);
                expect(get2.body.cpu).to.eql(1);
                expect(get2.body.options.pending).to.eql(true);
                expect(get3.body.cpu).to.eql(1);
                expect(get3.body.options.pending).to.eql(false);
                expect(get4.body.cpu).to.eql(2);
                expect(get4.body.options.pending).to.eql(false);
            });
        });

        describe('GitLab', () => {
            // this test is actually perform an HTTP request
            it.skip('should create build with last commit data', async () => {
                const url = 'https://gitlab.com/nassih/build-git.git';
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url,
                        token: '1234',
                        gitKind: 'gitlab'
                    },
                    env: 'nodejs',
                    type: 'Git'
                };
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });
        });

        describe('Image', () => {
            it('should not take affect on algorithmImage change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        pending: false
                    }
                };
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage'
                };
                const uri = applyPath;
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1 });
            });

            it('should take affect on algorithmImage change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        pending: false
                    }
                };
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage'
                };
                const uri = applyPath;
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...apply1, ...apply2 });
            });

            it('should not apply changes to current when algorithmImage changes', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5
                };
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage',
                    cpu: 2
                };
                const uri = applyPath;
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: false }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1 });
            });

            it('should apply changes to current when algorithmImage changes with forceUpdate', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5
                };
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage',
                    cpu: 2
                };
                const uri = applyPath;
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });

            it('should succeed to apply algorithm with just cpu change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5
                };
                const apply2 = {
                    name: apply1.name,
                    cpu: 2
                };
                const uri = applyPath;
                const request1 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);

                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });

            it('should succeed to apply algorithm with just gpu change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5
                };
                const apply2 = {
                    name: apply1.name,
                    gpu: 2
                };
                const uri = applyPath;
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1 });
            });

            it('should succeed to apply algorithm with just mem change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        pending: false
                    }
                };
                const apply2 = {
                    name: apply1.name,
                    mem: '1.5Gi'
                };
                const uri = applyPath;
                const request1 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });

            it('should succeed to apply algorithm with just minHotWorkers change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        pending: false
                    }
                };
                const apply2 = {
                    name: apply1.name,
                    minHotWorkers: 3
                };
                const uri = applyPath;
                const request1 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });

            it('should succeed to apply algorithm with just algorithmEnv change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    type: 'Image',
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        pending: false
                    },
                    algorithmEnv: {
                        storage: 's3'
                    }
                };
                const apply2 = {
                    name: apply1.name,
                    algorithmEnv: {
                        storage: 'fs'
                    }
                };
                const uri = applyPath;
                const request1 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                const { version, created, modified, reservedMemory, ...algorithm } = response3.body;
                expect(algorithm).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });

            it('should succeed to add and delete algorithmEnv', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    algorithmEnv: {
                        storage_env: 's3',
                        stam_env: 'v344'
                    }
                };
                const apply2 = {
                    name: apply1.name,
                    algorithmEnv: {
                        storage_env: 's3'
                    }
                };
                const uri = applyPath;
                const request1 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ forceUpdate: true }), payload: JSON.stringify(apply2) } };

                await request(request1);
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body.algorithmEnv.storage_env).to.eql('s3');
                expect(response3.body.algorithmEnv.stam_env).to.not.exist;
            });

            it('should succeed to add algorithmEnv from configMap', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    algorithmEnv: {
                        storage_env: 's3',
                        cm_env: { configMapKeyRef: { name: 'my-cm', key: 'cm_env' } }
                    }
                };

                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };

                await request(request1);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body.algorithmEnv.storage_env).to.eql('s3');
                expect(response3.body.algorithmEnv.cm_env).to.eql({ configMapKeyRef: { name: 'my-cm', key: 'cm_env' } });
            });

            it('should fail to add algorithmEnv not from list', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    algorithmEnv: {
                        storage_env: 's3',
                        cm_env: { foo: { name: 'my-cm', key: 'cm_env' } }
                    }
                };

                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };

                const response1 = await request(request1);
                expect(response1.body.error.message).to.eql('data should be equal to one of the allowed values (fieldRef,configMapKeyRef,resourceFieldRef,secretKeyRef)');
            });

            it('should succeed to add reservedMemory', async () => {
                const reservedMemory = '512Mi';
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    reservedMemory
                };
                const uri = applyPath;
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req);
                expect(res.body.algorithm.reservedMemory).to.eql(reservedMemory);
            });

            it('should succeed to calc reservedMemory', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '1024Mi'
                };
                const req = { uri: applyPath, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req);
                expect(res.body.algorithm.reservedMemory).to.eql('205Mi');
            });

            it('should succeed to add created and modified', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage'
                };
                const req = { uri: applyPath, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req);
                expect(res.body.algorithm).to.have.property('created');
                expect(res.body.algorithm).to.have.property('modified');
            });

            it('should succeed to apply baseImage without build', async () => {
                const body1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    baseImage: 'python:2.7'
                };
                const body2 = {
                    ...body1,
                    baseImage: 'python:3.7'
                };
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body1) }
                };
                const options2 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body2) }
                };
                const response1 = await request(options1);
                const response2 = await request(options2);
                expect(response1.body).to.not.have.property('buildId');
                expect(response2.body).to.not.have.property('buildId');
            });

            it('should succeed to add labels and annotations', async () => {
                const apply = {
                    name: `alg-${uuid()}`,
                    algorithmImage: 'algorithmImage',
                    labels: {
                        'my.custom.key': 'my.custom.value'
                    },
                    annotations: {
                        'my.custom.key': 'my.custom.value'
                    }
                };
                const req = { uri: applyPath, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req);
                expect(res.body.algorithm.labels).to.eql(apply.labels);
                expect(res.body.algorithm.annotations).to.eql(apply.annotations);
            });
        });

        describe('Versions', () => {
            it('should create one version', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    cpu: 1,
                    mem: '50Mi'
                };
                const req = { uri: applyPath, formData: { payload: JSON.stringify(apply) } };
                const res1 = await request(req);
                await Promise.all([request(req), request(req), request(req)]);
                const res2 = await request(req);
                const res3 = await request({ uri: `${versionsPath}/${apply.name}`, method: 'GET' });
                const ver = res3.body[0];
                expect(res1.body.algorithm).to.eql(res2.body.algorithm);
                expect(res1.body.algorithm).to.have.property('version');
                expect(res3.body).to.have.lengthOf(1);
                expect(res1.body.algorithm).to.have.property('version');
                expect(ver.version).to.eql(res1.body.algorithm.version);
                expect(ver).to.have.property('version');
                expect(ver).to.have.property('name');
                expect(ver).to.have.property('algorithm');
                expect(ver).to.have.property('created');
            });

            it('should create multiple versions', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    cpu: 1
                };
                const apply2 = {
                    ...apply1,
                    cpu: 2
                };
                const apply3 = {
                    ...apply1,
                    cpu: 3
                };
                const req1 = { uri: applyPath, formData: { payload: JSON.stringify(apply1) } };
                const req2 = { uri: applyPath, formData: { payload: JSON.stringify(apply2) } };
                const req3 = { uri: applyPath, formData: { payload: JSON.stringify(apply3) } };
                const req4 = { uri: `${versionsPath}/${apply1.name}`, method: 'GET' };
                const res1 = await request(req1);
                const res2 = await request(req2);
                const res3 = await request(req3);
                const res4 = await request(req4);
                const versions1 = res4.body.map((v) => v.version);
                const versions2 = [res3.body.algorithm.version, res2.body.algorithm.version, res1.body.algorithm.version];
                expect(versions1).to.eql(versions2);
            });

            it('should create multiple versions in concurrent mode', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: '50Mi',
                    cpu: 1
                };
                const apply2 = {
                    ...apply1,
                    cpu: 2
                };
                const apply3 = {
                    ...apply1,
                    cpu: 3
                };
                const apply4 = {
                    ...apply1,
                    cpu: 4
                };
                const apply5 = {
                    ...apply1,
                    cpu: 5
                };
                const req1 = { uri: applyPath, formData: { payload: JSON.stringify(apply1) } };
                const req2 = { uri: applyPath, formData: { payload: JSON.stringify(apply2) } };
                const req3 = { uri: applyPath, formData: { payload: JSON.stringify(apply3) } };
                const req4 = { uri: applyPath, formData: { payload: JSON.stringify(apply4) } };
                const req5 = { uri: applyPath, formData: { payload: JSON.stringify(apply5) } };
                const req6 = { uri: `${versionsPath}/${apply1.name}`, method: 'GET' };
                const response = await Promise.all([request(req1), request(req2), request(req3), request(req4), request(req5)]);
                const versionsRes = await request(req6);
                const versions1 = response.map((v) => v.body.algorithm.version).sort(); // sort because Promise.all order
                const versions2 = versionsRes.body.map((v) => v.version).sort();
                const semver = versionsRes.body.map((v) => v.semver);
                expect(versions1).to.eql(versions2);
                expect(semver).to.eql(['1.0.4', '1.0.3', '1.0.2', '1.0.1', '1.0.0']);
            });
        });
    });

    describe('/store/algorithms PUT', () => {
        it('should throw validation error of memory min 4 Mi', async () => {
            const algo = Object.assign({}, algorithms[0]);
            algo.mem = '3900Ki';
            const options = {
                method: 'PUT',
                uri: restPath,
                body: { payload: JSON.stringify({ ...algo }) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
        });

        it('should succeed to update algorithm', async () => {
            const algo = { ...algorithms[0] };
            const options = {
                uri: restPath,
                method: 'PUT',
                body: { payload: JSON.stringify({ ...algo }) }
            };
            const response = await request(options);
            const { reservedMemory, ...res } = response.body.algorithm;
            expect(res).to.eql(algo);
        });

        it('should failed to update algorithm', async () => {
            const algo = { ...algorithms[0], algorithmImage: '' };
            const options = {
                uri: restPath,
                method: 'PUT',
                body: { payload: JSON.stringify({ ...algo }) }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal('cannot apply algorithm due to missing image url or build data');
        });

        it('should succeed to update algorithm image', async () => {
            const algo = algorithms[0];
            const options = {
                uri: restPath,
                method: 'PUT',
                body: { payload: JSON.stringify({ ...algo, algorithmImage: 'new-image' }) }
            };
            const response = await request(options);
            expect(response.body.algorithm.version).to.be.exist;
            expect(response.body.algorithm.algorithmImage).to.not.eql(algo.algorithmImage);
        });
    });
});
