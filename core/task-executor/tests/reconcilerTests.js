const { expect } = require('chai');
const { stateType } = require('@hkube/consts');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const clone = require('lodash.clonedeep');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const etcd = require('../lib/helpers/etcd');
const { normalizeResources } = require('../lib/reconcile/normalize');
const awsAccessKeyId = { name: 'AWS_ACCESS_KEY_ID', valueFrom: { secretKeyRef: { name: 's3-secret', key: 'awsKey' } } };
const awsSecretAccessKey = { name: 'AWS_SECRET_ACCESS_KEY', valueFrom: { secretKeyRef: { name: 's3-secret', key: 'awsSecret' } } };
const s3EndpointUrl = { name: 'S3_ENDPOINT_URL', valueFrom: { secretKeyRef: { name: 's3-secret', key: 'awsEndpointUrl' } } };
const fsVolumes = { name: 'storage-volume', persistentVolumeClaim: { claimName: 'hkube-storage-pvc' } };
const fsVolumeMounts = { name: 'storage-volume', mountPath: '/hkubedata' };
const { workerTemplate, varlogMount, varlibdockercontainersMount, varLog, varlibdockercontainers, } = require('../lib/templates/index');
const { settings: globalSettings } = require('../lib/helpers/settings');
const { consts } = require('../lib/consts');
const resources = require('./stub/resources');
const { requestsManager } = require('../lib/reconcile/managers');

const options = main;
let callCount, clearCount, normResources, reconciler, algorithmTemplates;

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(0.5 * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

describe('reconciler', () => {
    /**
     * Creates an argument object for the reconciler.
     *
     * @param {string | string[]} algNamesRequest - A single algorithm name or an array of algorithm names (normRequests).
     * @param {Object} [options={}] - Optional configuration overrides.
     * @param {Object} [options.localOptions=options] - Overrides the default `options` if provided.
     * @param {Object} [options.localNormResources=normResources] - Overrides the default `normResources` if provided.
     * @param {Object} [options.localAlgorithmTemplates=algorithmTemplates] - Overrides the default `algorithmTemplates` if provided.
     * @param {Object} [options.clusterOptions]
     * @param {Object} [options.versions]
     * @param {Object} [options.registry]
     * @param {Object} [options.workerResources]
     * @param {Object} [options.workers]
     * @returns {Object} The argument object for the reconciler, containing options, normResources, algorithmTemplates, algorithmRequests, clusterOptions, versions, registry, workerResources, and workers.
     */
    const createReconcileArgs = (algNamesRequest, { localOptions = options, localNormResources = normResources, localAlgorithmTemplates = algorithmTemplates,
        clusterOptions, versions, registry, workerResources, workers } = {}) => {
        const data = Array.isArray(algNamesRequest) ? algNamesRequest.map(name => ({ name })) : [{ name: algNamesRequest }];
        return {
            options: localOptions,
            normResources: localNormResources,
            algorithmTemplates: localAlgorithmTemplates,
            algorithmRequests: [{ data }],
            // jobs: {
            //     body: {
            //         items: []
            //     }
            // },
            clusterOptions,
            versions,
            registry,
            workerResources,
            workers
        }
    }

    before(async () => {
        reconciler = require('../lib/reconcile/reconciler');

        algorithmTemplates = await etcd.getAlgorithmTemplate();

        callCount = global.testParams.callCount;
        clearCount = global.testParams.clearCount;
    });

    beforeEach(() => {
        clearCount();
        reconciler._clearCreatedJobsLists(options, Date.now() + 100000);
        const { requestsManager } = require('../lib/reconcile/managers');
        requestsManager.updateCapacity(1000);
        const res = clone(resources);
        res.nodes.body.items.push(res.nodeWithLabels);
        normResources = normalizeResources(res);
        globalSettings.useResourceLimits = false;
        globalSettings.applyResources = false;
    });

    describe('reconcile algorithms tests', () => {
        it('should work with no params', async () => {
            const res = await reconciler.reconcile({ normResources, options });

            expect(res).to.exist;
            expect(res).to.be.empty;
            expect(callCount('createJob')).to.be.undefined;
        })

        it('should work with one algo', async () => {
            const algorithm = 'black-alg';
            const res = await reconciler.reconcile(createReconcileArgs(algorithm));

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });

        xit('should keep node selector', async () => {
            const algorithm = 'black-alg';
            const argument = createReconcileArgs(algorithm, { clusterOptions: { useNodeSelector: true } } );
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.exist;
        });

        xit('should remove node selector', async () => {
            const algorithm = 'black-alg';
            const argument = createReconcileArgs(algorithm, { clusterOptions: { useNodeSelector: false } } );
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.be.undefined;
        });

        xit('should remove node selector 2', async () => {
            const algorithm = 'black-alg';
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.be.undefined;
        });

        xit('should keep node selector', async () => {
            const algorithm = 'black-alg';
            const argument = createReconcileArgs(algorithm, { clusterOptions: { useNodeSelector: true } } );
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.exist;
        });

        it('should work with algorithm with not enough cpu', async () => {
            const algorithm = 'hungry-alg';
            algorithmTemplates[algorithm] = {
                name: algorithm,
                algorithmImage: 'hkube/algorithm-example',
                cpu: 10,
                mem: 100
            };
            const argument = createReconcileArgs(Array(4).fill(algorithm));
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 4, paused: 0, created: 0, skipped: 4, resumed: 0 } });
        });

        it('should only create 40 in one iteration', async () => {
            const size = 40;
            const algorithm = 'hungry-alg';
            algorithmTemplates[algorithm] = {
                name: algorithm,
                algorithmImage: 'hkube/algorithm-example',
                cpu: 0.1,
                mem: 100
            };
            const argument = createReconcileArgs(Array(size).fill(algorithm));
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: size, paused: 0, created: size, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(size);
        });

        it('should work with algorithm with enough resources', async () => {
            const algorithm = 'hungry-alg';
            algorithmTemplates[algorithm] = {
                name: algorithm,
                algorithmImage: 'hkube/algorithm-example',
                cpu: 2,
                mem: 100
            };
            const argument = createReconcileArgs(Array(4).fill(algorithm));
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 4, paused: 0, created: 4, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(4);
        });

        it('should work with algorithm with not enough memory', async () => {
            const algorithm = 'hungry-alg';
            algorithmTemplates[algorithm] = {
                name: algorithm,
                algorithmImage: 'hkube/algorithm-example',
                cpu: 4,
                mem: 40000
            };
            const argument = createReconcileArgs(Array(4).fill(algorithm));
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 4, paused: 0, created: 0, skipped: 4, resumed: 0 } });
        });

        it('should work with custom worker', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerImage: 'myregistry:5000/stam/myworker:v2',
                cpu: 2,
                mem: 400
            };
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('myregistry:5000/stam/myworker:v2');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });

        it('should work with custom worker tag', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerImage: 'hkube/worker:v3.2.1-beta1',
                cpu: 2,
                mem: 400
            };
            const versions = {
                "systemVersion": "v2.0.74",
                "fullSystemVersion": "v2.0.74-1612455176042",
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v2.0.25",
                        "image": "hkube/worker"
                    }
                ]
            }
            const argument = createReconcileArgs(algorithm, { versions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker:v3.2.1-beta1');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });

        it('should work with custom workerImage', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerImage: 'foo/bar:v3.2.1-beta1',
                cpu: 2,
                mem: 400
            };
            const versions = {
                "systemVersion": "v2.0.74",
                "fullSystemVersion": "v2.0.74-1612455176042",
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v2.0.25",
                        "image": "hkube/worker"
                    }
                ]
            }
            const argument = createReconcileArgs(algorithm, { versions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('foo/bar:v3.2.1-beta1');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });

        it('should work with custom workerImage and registry', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerImage: 'foo/bar:v3.2.1-beta1',
                cpu: 2,
                mem: 400
            };
            const versions = {
                "systemVersion": "v2.0.74",
                "fullSystemVersion": "v2.0.74-1612455176042",
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v2.0.25",
                        "image": "hkube/worker"
                    }
                ]
            }
            const registry = { registry: 'my.registry/prefix' };
            const argument = createReconcileArgs(algorithm, { versions, registry });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('my.registry/prefix/foo/bar:v3.2.1-beta1');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('my.registry/prefix/hkube/algorithm-example');
        });

        it('should work with env', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env).to.deep.include({ name: 'myEnv', value: 'myValue' });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].env).to.deep.include({ name: 'myAlgoEnv', value: 'myAlgoValue' });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });

        it('setting java memory barrier as env in spec', async () => {
            const algorithm = 'black-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                env: "java",
                mem: "2048",
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };
            const argument = createReconcileArgs(algorithm);
            await reconciler.reconcile(argument);

            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].env).to.deep.include({ name: 'JAVA_DERIVED_MEMORY', value: '3277' });
        });

        it('should add mounts', async () => {
            const algorithm = 'green-alg';
            const mounts = [
                {
                    pvcName: 'mypvc',
                    path: '/mnt/stam'
                },
                {
                    pvcName: 'mypvc2',
                    path: '/tmp/foo'
                }
            ]
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                },
                mounts
            };

            const localOptions = { ...options, defaultStorage: 'fs' };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].volumeMounts).to.deep.include({
                name: 'mypvc-0',
                mountPath: mounts[0].path
            });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include({
                name: 'mypvc-0',
                persistentVolumeClaim: { claimName: mounts[0].pvcName }
            });
        });

        it('should add Privileged flag by default', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };

            const localOptions = { ...options, defaultStorage: 'fs', jaeger: { host: 'foo.bar' } };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.include(varlogMount);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.include(varlibdockercontainersMount);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include(varLog);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include(varlibdockercontainers);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].securityContext.privileged).to.be.true;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env
                .find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.have.property('valueFrom')
        });

        it('should not add Privileged flag if configured', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };

            const localOptions = { ...options, defaultStorage: 'fs', kubernetes: { ...options.kubernetes, isPrivileged: false } };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.not.include(varlogMount);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.not.include(varlibdockercontainersMount);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.not.include(varLog);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.not.include(varlibdockercontainers);

            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].securityContext).to.not.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.be.undefined

            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include({
                name: 'logs',
                emptyDir: {}
            });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.include({
                name: 'logs',
                mountPath: '/hkube-logs/'
            });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].volumeMounts).to.deep.include({
                name: 'logs',
                mountPath: '/hkube-logs/'
            });
        });

        it('should add jaeger host when not Privileged if configured', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };

            const localOptions = { ...options, defaultStorage: 'fs', jaeger: { host: 'foo.bar' }, kubernetes: { ...options.kubernetes, isPrivileged: false } };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env
                .find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST').value).to.eql(localOptions.jaeger.host);
        });

        it('should add env param, volume, volumeMount if fs is defaultStorage', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };

            const localOptions = { ...options, defaultStorage: 'fs' };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.include(fsVolumeMounts);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include(fsVolumes);
        });

        it('should set env for reservedMemory', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                },
                reservedMemory: '256Mi'
            };

            const localOptions = { ...options, defaultStorage: 'fs' };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].env).to.deep.include({ name: 'DISCOVERY_MAX_CACHE_SIZE', value: '256' });
        });

        it('should add env param if s3 is defaultStorage', async () => {
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };

            const localOptions = { ...options, defaultStorage: 's3' };
            const argument = createReconcileArgs(algorithm, { localOptions });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env).to.deep.include(awsAccessKeyId);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env).to.deep.include(awsSecretAccessKey);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env).to.deep.include(s3EndpointUrl);
        });

        it('should add worker resources', async () => {
            globalSettings.applyResources = true
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
            };

            const localOptions = { ...options, defaultStorage: 's3' };
            const workerResources = localOptions.resources.worker;
            const argument = createReconcileArgs(algorithm, { localOptions, workerResources });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ limits: { cpu: 1, memory: '1024Mi' } });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ requests: { cpu: 0.5, memory: '512Mi' } });
        });

        it('should add workerCustomResources without applyResources flag', async () => {
            const algorithm = 'worker-custom-resources-alg';
            const localOptions = { ...options, defaultStorage: 's3' };

            const workerResources = localOptions.resources.worker;
            const argument = createReconcileArgs(algorithm, { localOptions, workerResources });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ limits: { cpu: 0.2, memory: '512Mi' } });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ requests: { cpu: 0.1 , memory: '256Mi' } });
        });

        it('should add worker resources when workerCustomResources is with partial spec using default for missing values', async () => {
            globalSettings.applyResources = true
            const algorithm = 'worker-custom-resources-nolimit-alg';
            const localOptions = { ...options, defaultStorage: 's3' };

            const workerResources = localOptions.resources.worker;
            const argument = createReconcileArgs(algorithm, { localOptions, workerResources });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources.limits).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ requests: { cpu: 0.1, memory: '256Mi' } });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ limits: { cpu: 1, memory: '1024Mi' } });
        });

        it('should not add worker resources', async () => {
            globalSettings.applyResources = false
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
            };
            const localOptions = { ...options, defaultStorage: 's3' };

            const workerResources = localOptions.resources.worker;
            const argument = createReconcileArgs(algorithm, { localOptions, workerResources });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.not.exist;
        });

        it('should add worker resources useLimits', async () => {
            globalSettings.useResourceLimits = true
            globalSettings.applyResources = true

            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
            };
            const localOptions = { ...options, defaultStorage: 's3' };

            const workerResources = localOptions.resources.worker;
            const argument = createReconcileArgs(algorithm, { localOptions, workerResources });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ limits: { cpu: 0.5, memory: '512Mi' } });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ requests: { cpu: 0.5, memory: '512Mi' } });
        });
    });

    describe('reconcile with maxWorkers', () => {
        it('should not create job when there is ready worker', async () => {
            const algorithm1 = 'withMaxWorkers';
            const algorithmImage = 'hkube/algorithm-example';
            const workerImage = 'hkube/worker';
            const workerStatus = 'ready';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                maxWorkers: 1,
                cpu: 0.1,
                mem: 100
            };
            const workers = [
                { workerId: `${algorithm1}-1`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus }
            ];

            const argument = createReconcileArgs(algorithm1, { workers });
            const res = await reconciler.reconcile(argument);

            expect(res[algorithm1].required).to.eql(0);
            expect(res[algorithm1].created).to.eql(0);
            expect(res[algorithm1].active).to.eql(1);
        });

        it('should not create job when there is active worker', async () => {
            const algorithm1 = 'withMaxWorkers';
            const algorithmImage = 'hkube/algorithm-example';
            const workerImage = 'hkube/worker';
            const workerStatus = 'active';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                maxWorkers: 1,
                cpu: 0.1,
                mem: 100
            };
            const workers = [
                { workerId: `${algorithm1}-1`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus }
            ];

            const argument = createReconcileArgs(algorithm1, { workers });
            const res = await reconciler.reconcile(argument);

            expect(res[algorithm1].required).to.eql(0);
            expect(res[algorithm1].created).to.eql(0);
            expect(res[algorithm1].active).to.eql(1);
        });

        it('should create job when there are not enough worker', async () => {
            const algorithm1 = 'withMaxWorkers';
            const algorithmImage = 'hkube/algorithm-example';
            const workerImage = 'hkube/worker';
            const workerStatus = 'active';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                maxWorkers: 4,
                cpu: 0.1,
                mem: 100
            };
            const workers = [
                { workerId: `${algorithm1}-1`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus },
                { workerId: `${algorithm1}-2`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus }
            ];

            const argument = createReconcileArgs(Array(6).fill(algorithm1), { workers });
            const res = await reconciler.reconcile(argument);

            expect(res[algorithm1].required).to.eql(2);
            expect(res[algorithm1].created).to.eql(2);
            expect(res[algorithm1].active).to.eql(2);
        });

        it('should create job when there is no worker', async () => {
            const algorithm1 = 'withMaxWorkers';
            const algorithmImage = 'hkube/algorithm-example';

            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                maxWorkers: 1,
                cpu: 0.1,
                mem: 100
            };
            const workers = [];

            const argument = createReconcileArgs(algorithm1, { workers });
            const res = await reconciler.reconcile(argument);

            expect(res[algorithm1].required).to.eql(1);
            expect(res[algorithm1].created).to.eql(1);
        });
    });

    describe('reconcile algorithms quotaGuarantee', () => {
        it('should work with algorithm with no quotaGuarantee', async () => {
            const algorithm1 = 'no-requisite-x';
            const algorithm2 = 'no-requisite-y';
            const algorithm3 = 'requisite-1';
            const algorithm4 = 'requisite-2';
            const algorithmImage = 'hkube/algorithm-example';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm2] = {
                name: algorithm2,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm3] = {
                name: algorithm3,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm4] = {
                name: algorithm4,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            const amount = 100;

            const array = [
                ...Array(amount).fill(algorithm1),
                ...Array(amount).fill(algorithm2),
                ...Array(amount).fill(algorithm3),
                ...Array(amount).fill(algorithm4),
            ]
            const argument = createReconcileArgs(array);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res[algorithm1].required).to.eql(res[algorithm1].created);
            expect(res[algorithm2].required).to.eql(res[algorithm2].created);
        });

        it('should create quotaGuarantee as example doc', async () => {
            const algorithm1 = 'green';
            const algorithm2 = 'yellow';
            const algorithm3 = 'black';
            const algorithmImage = 'hkube/algorithm-example';
            const workerImage = 'hkube/worker';
            const workerStatus = 'ready';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                quotaGuarantee: 80,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm2] = {
                name: algorithm2,
                algorithmImage,
                quotaGuarantee: 20,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm3] = {
                name: algorithm3,
                algorithmImage,
                quotaGuarantee: 10,
                cpu: 0.1,
                mem: 100
            };
            const requests = [
                ...Array(800).fill(algorithm1),
                ...Array(200).fill(algorithm2),
                ...Array(100).fill(algorithm3),
            ]
            const workers = [
                ...Array.from(Array(70).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus })),
                ...Array.from(Array(12).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm2, workerStatus })),
                ...Array.from(Array(5).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm3, workerStatus })),
            ];
            const algorithms = shuffle(requests);
            const argument = createReconcileArgs(algorithms, { workers });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res[algorithm1].required).to.eql(res[algorithm1].created);
            expect(res[algorithm2].required).to.eql(res[algorithm2].created);
            expect(res[algorithm3].required).to.eql(res[algorithm3].created);
        });

        it('should work with algorithm with small quotaGuarantee', async () => {
            const algorithm1 = 'no-requisite-x';
            const algorithm2 = 'no-requisite-y';
            const algorithm3 = 'requisite-1';
            const algorithm4 = 'requisite-2';
            const algorithmImage = 'hkube/algorithm-example';
            const workerImage = 'hkube/worker';
            const workerStatus = 'ready';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm2] = {
                name: algorithm2,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm3] = {
                name: algorithm3,
                algorithmImage,
                quotaGuarantee: 20,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm4] = {
                name: algorithm4,
                algorithmImage,
                quotaGuarantee: 10,
                cpu: 0.1,
                mem: 100
            };
            const requestsAmount = 100;
            const workersAmount = 5;
            const requests = [
                ...Array(requestsAmount).fill(algorithm1),
                ...Array(requestsAmount).fill(algorithm2),
                ...Array(requestsAmount).fill(algorithm3),
                ...Array(requestsAmount).fill(algorithm4),
            ]
            const workers = [
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus })),
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm2, workerStatus })),
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm3, workerStatus })),
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm4, workerStatus }))
            ];
            const algorithms = shuffle(requests);
            const argument = createReconcileArgs(algorithms, { workers });
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res[algorithm3].required).to.eql(res[algorithm3].created);
            expect(res[algorithm4].required).to.eql(res[algorithm4].created);
        });

        it('should prioritizing quotaGuarantee', async () => {
            const algorithm1 = 'no-requisite-x';
            const algorithm2 = 'no-requisite-y';
            const algorithm3 = 'requisite-1';
            const algorithm4 = 'requisite-2';
            const algorithmImage = 'hkube/algorithm-example';
            algorithmTemplates[algorithm1] = {
                name: algorithm1,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm2] = {
                name: algorithm2,
                algorithmImage,
                quotaGuarantee: 0,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm3] = {
                name: algorithm3,
                algorithmImage,
                quotaGuarantee: 90,
                cpu: 0.1,
                mem: 100
            };
            algorithmTemplates[algorithm4] = {
                name: algorithm4,
                algorithmImage,
                quotaGuarantee: 90,
                cpu: 0.1,
                mem: 100
            };
            const amount = 100;
            const data = [
                ...Array(amount).fill(algorithm1),
                ...Array(amount).fill(algorithm2),
                ...Array(amount).fill(algorithm3),
                ...Array(amount).fill(algorithm4),
            ]
            const argument = createReconcileArgs(data);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res[algorithm3].required).to.eql(res[algorithm3].created);
            expect(res[algorithm4].required).to.eql(res[algorithm4].created);
        });
    });

    describe('reconcile algorithms scheduling tests', () => {
        it('should update algorithm that cannot be scheduled due to cpu', async () => {
            const algorithm = algorithmTemplates['big-cpu'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            await reconciler.reconcile(argument);
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Insufficient cpu (4)');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].amountsMissing.cpu).to.eql('1.18');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[1].amountsMissing.cpu).to.eql('1.23');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[2].amountsMissing.cpu).to.eql('0.98');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[3].amountsMissing.cpu).to.eql('7.18');
            expect(algorithms[algorithm.name].surpassTimeout).to.be.false;
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount - 1, paused: 0, created: 0, skipped: amount - 1, resumed: 0 } });
        });

        it('should update algorithm that cannot be scheduled due to invalid volume', async () => {
            const algorithm = algorithmTemplates['algo-pvc-non-exist'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('One or more volumes are missing or do not exist.\nMissing volumes: hjkjhgfdfjkjhgffg');
            expect(algorithms[algorithm.name].surpassTimeout).to.be.oneOf([false, undefined]);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        }).timeout(1000000);

        it('should update algorithm that cannot be scheduled due to failed job (when limits are lower than requests)', async () => {
            const algorithm = algorithmTemplates['algo-car-lim-lower-req'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Kubernetes Job is invalid: mycar.resources.requests: Invalid value: 3: must be less than or equal to cpu limit');
            expect(algorithms[algorithm.name].surpassTimeout).to.be.true;
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        }).timeout(1000000);

        it('should update algorithm that cannot be scheduled due to memory', async () => {
            const algorithm = algorithmTemplates['big-mem'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            await reconciler.reconcile(argument);
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Insufficient mem (4)');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].amountsMissing.mem).to.eql('11929.60');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[1].amountsMissing.mem).to.eql('12057.60');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[2].amountsMissing.mem).to.eql('11673.60');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[3].amountsMissing.mem).to.eql('36454.40');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount - 1, paused: 0, created: 0, skipped: amount - 1, resumed: 0 } });
        });

        it('should create algorithm that does not use GPU in openshift mode', async () => {
            const algorithm = algorithmTemplates['yellow-alg'];
            const localResources = clone(resources);
            const localNormResources = normalizeResources({ nodes: localResources.nodesNoGpu, pods: localResources.podsGpu });
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(algorithm.name, { localNormResources, localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);

            expect(res['yellow-alg'].created).to.eql(1)
        });

        it('should update algorithm that cannot be scheduled due to gpu', async () => {
            const algorithm = algorithmTemplates['big-gpu'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            await reconciler.reconcile(argument);
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Insufficient gpu (4)');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].amountsMissing.gpu).to.eql('3.00');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[1].amountsMissing.gpu).to.eql('4.00');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[2].amountsMissing.gpu).to.eql('6.00');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[3].amountsMissing.gpu).to.eql('4.00');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount - 1, paused: 0, created: 0, skipped: amount - 1, resumed: 0 } });
        });

        it('should update algorithm that cannot be scheduled due to max limit cpu', async () => {
            const algorithm = algorithmTemplates['max-cpu'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Maximum capacity exceeded cpu (4)');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].amountsMissing.cpu).to.eql('18.18');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].requestsOverMaxCapacity[0]).to.eql(['cpu',true]);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
        });

        it('should update algorithm that cannot be scheduled due to max limit memory', async () => {
            const algorithm = algorithmTemplates['max-mem'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Maximum capacity exceeded mem (4)');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].amountsMissing.mem).to.eql('25241.60');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].requestsOverMaxCapacity[0]).to.eql(['mem',true]);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
        });

        it('should update algorithm that cannot be scheduled due to max limit gpu', async () => {
            const algorithm = algorithmTemplates['max-gpu'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Maximum capacity exceeded gpu (4)');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].amountsMissing.gpu).to.eql('7.00');
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].requestsOverMaxCapacity[0]).to.eql(['gpu',true]);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
        });

        it('should update algorithm that cannot be scheduled due to node selector', async () => {
            const algorithm = algorithmTemplates['node-selector'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql(`No nodes available for scheduling due to selector condition - 'type=cpu-extreme'`);
            expect(algorithms[algorithm.name].complexResourceDescriptor.numUnmatchedNodesBySelector).to.eql(4);
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes).to.eql([]);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
        });

        it('should update algorithm that cannot be scheduled due to all params', async () => {
            const algorithm = algorithmTemplates['node-all-params'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;

            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql(`Maximum capacity exceeded cpu (1) mem (1) gpu (1)`);
            expect(algorithms[algorithm.name].complexResourceDescriptor.numUnmatchedNodesBySelector).to.eql(3);
            expect(algorithms[algorithm.name].complexResourceDescriptor.nodes[0].nodeName).to.eql('node4');
            expect(algorithms[algorithm.name].complexResourceDescriptor.requestedSelectors).to.eql(['type=gpu-extreme','max=bound']);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
        });

        it('should update algorithm unschedule and then succeed to schedule', async () => {
            const algorithm = algorithmTemplates['eval-alg'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: { ...algorithm, cpu: 25 } };
            const argument1 = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const argument2 = { ...argument1, algorithmTemplates: { [algorithm.name]: { ...algorithm, cpu: 1 } } };
            const res1 = await reconciler.reconcile(argument1);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            const res2 = await reconciler.reconcile(argument2);
            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('Maximum capacity exceeded cpu (4)');
            expect(res1).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
            expect(res2).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: amount, skipped: 0, resumed: 0 } });
        });

        it('should not allocate algorithm with multiple values in the same nodeSelector key ', async () => {
            const algorithm = algorithmTemplates['selector-multi-values'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql("No nodes available for scheduling due to selector condition - 'kubernetes.io/hostname=node1,node2,node3'");
            expect(algorithms[algorithm.name].complexResourceDescriptor.numUnmatchedNodesBySelector).to.eql(4);
            expect(algorithms[algorithm.name].complexResourceDescriptor.requestedSelectors).to.eql(["kubernetes.io/hostname=node1,node2,node3"]);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: amount, paused: 0, created: 0, skipped: amount, resumed: 0 } });
        });

        it('should allocate algorithm with multiple values in the same nodeSelector key ', async () => {
            const algorithm = algorithmTemplates['selector-multi-values-node4'];
            const amount = 3;
            const localAlgorithmTemplates = { [algorithm.name]: algorithm };
            const argument = createReconcileArgs(Array(amount).fill(algorithm.name), { localAlgorithmTemplates });
            const res = await reconciler.reconcile(argument);
            await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            expect(res[algorithm.name].required).to.eql(res[algorithm.name].created);globalSettings.sidecars
        });
    });

    describe('volume tests', function () {
        const volumeTypes = ['pvc', 'config-map', 'secret'];
        volumeTypes.forEach(async (volumeType) => {
            it(`should not schedule algorithm with non-existing ${volumeType}`, async () => {
                const algorithm = `algo-${volumeType}-non-exist`;
                const argument = createReconcileArgs(algorithm);
                const res = await reconciler.reconcile(argument);
                expect(res).to.exist;
                expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 0, skipped: 1, resumed: 0 } });
            });
        });

        volumeTypes.forEach(async (volumeType) => {
            it(`should schedule algorithm with existing ${volumeType}`, async () => {
            const algorithm = `algo-${volumeType}-exist`;
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            });
        });
    });

    describe('reconcile algorithms with kaiObject', function() {
        it('should schedule algorithm with kaiObject', async () => {
            const algorithm = 'algo-kai-object';
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
        });

        it('should schedule algorithm with empty kaiObject', async () => {
            const algorithm = 'algo-kai-object-empty';
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
        });

        const generateMessage = (algorithm, givenMessage) => {
            const expectedMessage = `Kai object validation failed for algorithm ${algorithm.name} version ${algorithm.version}.\nError: ${givenMessage}`;
            return expectedMessage;
        }

        it('should not schedule algorithm with missing queue in kaiObject', async () => {
            const algorithm = algorithmTemplates['algo-kai-object-no-queue'];
            const argument = createReconcileArgs(algorithm.name);
            const res = await reconciler.reconcile(argument);
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: 1, paused: 0, created: 0, skipped: 1, resumed: 0 } });

            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            const givenMessage = `Missing 'queue' in kaiObject for algorithm "${algorithm.name}"`;
            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql(generateMessage(algorithm, givenMessage));
        });

        it('should not schedule algorithm with not existing queue', async () => {
            const algorithm = algorithmTemplates['algo-kai-object-queue-not-exist'];
            const argument = createReconcileArgs(algorithm.name);
            const res = await reconciler.reconcile(argument);
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: 1, paused: 0, created: 0, skipped: 1, resumed: 0 } });

            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            const givenMessage = `Queue "${algorithm.kaiObject.queue}" in kaiObject for algorithm "${algorithm.name}" does not exist in available Kai queues`;
            expect(algorithms[algorithm.name].reason).to.eql('failedScheduling');
            expect(algorithms[algorithm.name].message).to.eql(generateMessage(algorithm, givenMessage));
        });
    });

    describe('reconcile algorithms with sideCar', function () {
        it('should schedule algorithm with sideCar', async () => {
            const algorithm = 'algo-car-emptyDir';
            const argument = createReconcileArgs(algorithm);
            const res = await reconciler.reconcile(argument);
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            const spec = callCount('createJob')[0][0].spec.spec.template.spec
            expect(spec.containers[0].image).to.eql('hkube/worker');
            expect(spec.containers[1].image).to.eql('hkube/algorithm-example');
            expect(spec.containers.length).to.eql(3); // worker, algorunner, sidecar
            const volumes = spec.volumes;
            const volume = volumes.find(v => v.name === 'v1');

            expect(volume).to.have.property('emptyDir');
            expect(volume.emptyDir).to.be.an('object').that.deep.equals({});
        });
    });

    describe('reconcile different stateType algorithms', function () {
        const cases = [
            undefined,
            stateType.Stateful,
            stateType.Stateless
        ]

        cases.forEach((stateType) => {
            it(`should schedule algorithm with stateType ${stateType}`, async () => {
                const algorithm = `algo-state-type-${stateType ? stateType : 'undefined'}`;
                const argument = createReconcileArgs(algorithm, { stateType });
                const res = await reconciler.reconcile(argument);
                expect(res).to.exist;
                expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            });
        });

        it('should schedule streaming types without cutting', async () => {
            const algorithmStatefull = `algo-state-type-${stateType.Stateful}`;
            const algorithmStateless = `algo-state-type-${stateType.Stateless}`;
            const amount = consts.MAX_JOBS_PER_TICK / 2;
            const array = [
                ...Array(amount).fill(algorithmStatefull),
                ...Array(amount).fill(algorithmStateless)
            ];
            
            const argument = createReconcileArgs(array);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res[algorithmStatefull].required).to.eql(amount);
            expect(res[algorithmStatefull].created).to.eql(amount);
            expect(res[algorithmStateless].required).to.eql(amount);
            expect(res[algorithmStateless].created).to.eql(amount);
        });

        it('should cut non-streaming types (batch)', async () => {
            const algorithm = `algo-state-type-undefined`;
            const amount = consts.MAX_JOBS_PER_TICK;
            const array = Array(amount).fill(algorithm);
            
            const argument = createReconcileArgs(array);
            const res = await reconciler.reconcile(argument);

            expect(res).to.exist;
            expect(res[algorithm].required).to.be.lessThan(amount);
        });
    });
});