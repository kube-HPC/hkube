const { expect } = require('chai');
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
const { logVolumes, logVolumeMounts } = require('../lib/templates/index');
const { settings: globalSettings } = require('../lib/helpers/settings');

const resources = require('./stub/resources');
const drivers = require('./stub/drivers');
const options = main;
let callCount, clearCount, normResources, reconciler, driversReconciler, algorithmTemplates, driverTemplates;

const prepareDriversData = (options) => {
    const { minAmount, scalePercent, name } = options.driversSetting;
    const maxAmount = (minAmount * scalePercent) + minAmount;
    return { minAmount, maxAmount, name };
}
const settings = prepareDriversData(options);

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(0.5 * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

describe('reconciler', () => {
    before(async () => {
        reconciler = require('../lib/reconcile/reconciler');
        driversReconciler = require('../lib/reconcile/drivers-reconciler');

        algorithmTemplates = await etcd.getAlgorithmTemplate();
        driverTemplates = await etcd.getDriversTemplate();

        callCount = global.testParams.callCount;
        clearCount = global.testParams.clearCount;
    });
    beforeEach(() => {
        clearCount();
        reconciler._clearCreatedJobsList(Date.now() + 100000, options);
        reconciler._updateCapacity(1000)
        const res = clone(resources);
        res.nodes.body.items.push(res.nodeWithLabels);
        normResources = normalizeResources(res);
        globalSettings.useResourceLimits = false;
        globalSettings.applyResources = false;
    });
    describe('reconcile algorithms tests', () => {
        it('should work with no params', async () => {
            const res = await reconciler.reconcile({ normResources, options });
            expect(res).to.exist
            expect(res).to.be.empty
            expect(callCount('createJob')).to.be.undefined
        })
        it('should work with one algo', async () => {
            const algorithm = 'black-alg';
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [
                    {
                        data: [{
                            name: algorithm,
                        }]
                    }
                ],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
        xit('should keep node selector', async () => {
            const algorithm = 'black-alg';
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [
                    {
                        data: [{
                            name: algorithm,
                        }]
                    }
                ],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                },
                clusterOptions: {
                    useNodeSelector: true
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.exist;
        });
        xit('should remove node selector', async () => {
            const algorithm = 'black-alg';
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [
                    {
                        data: [{
                            name: algorithm,
                        }]
                    }
                ],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                },
                clusterOptions: {
                    useNodeSelector: false
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.be.undefined;
        });
        xit('should remove node selector 2', async () => {
            const algorithm = 'black-alg';
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [
                    {
                        data: [{
                            name: algorithm,
                        }]
                    }
                ],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.nodeSelector).to.be.undefined;
        });
        xit('should keep node selector', async () => {
            const algorithm = 'black-alg';
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [
                    {
                        data: [{
                            name: algorithm,
                        }]
                    }
                ],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                },
                clusterOptions: {
                    useNodeSelector: true
                }
            });
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
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [
                    {
                        data: [
                            {
                                name: algorithm,
                            },
                            {
                                name: algorithm,
                            },
                            {
                                name: algorithm,
                            },
                            {
                                name: algorithm,
                            }
                        ]
                    }
                ],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 4, paused: 0, created: 0, skipped: 4, resumed: 0 } });
        });
        it('should only create 40 in one iteration', async () => {
            const size = 40;
            algorithmTemplates['hungry-alg'] = {
                name: 'hungry-alg',
                algorithmImage: 'hkube/algorithm-example',
                cpu: 0.1,
                mem: 100
            };
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: Array.from(Array(size).keys()).map(a => ({
                        name: 'hungry-alg',
                    }))
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: size, paused: 0, created: size, skipped: 0, resumed: 0 } });
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
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: Array.from(Array(4).keys()).map(a => ({
                        name: algorithm,
                    }))
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: Array.from(Array(4).keys()).map(a => ({
                        name: algorithm,
                    }))
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [algorithm]: { idle: 0, required: 1, paused: 0, created: 1, skipped: 0, resumed: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('myregistry:5000/stam/myworker:v2');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
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
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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
            await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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

            const testOptions = { ...options, defaultStorage: 'fs' };
            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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

            const testOptions = { ...options, defaultStorage: 'fs', jaeger: { host: 'foo.bar' } };
            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.include(logVolumeMounts[0]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.include(logVolumeMounts[1]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include(logVolumes[0]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.include(logVolumes[1]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].securityContext.privileged).to.be.true;
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env
                .find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.have.property('valueFrom')
        })
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

            const testOptions = { ...options, defaultStorage: 'fs', kubernetes: { ...options.kubernetes, isPrivileged: false } };
            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.not.include(logVolumeMounts[0]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].volumeMounts).to.deep.not.include(logVolumeMounts[1]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.not.include(logVolumes[0]);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.volumes).to.deep.not.include(logVolumes[1]);

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


        })
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

            const testOptions = { ...options, defaultStorage: 'fs', jaeger: { host: 'foo.bar' }, kubernetes: { ...options.kubernetes, isPrivileged: false } };
            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env
                .find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST').value).to.eql(testOptions.jaeger.host);
        })
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

            const testOptions = { ...options, defaultStorage: 'fs' };
            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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

            const testOptions = { ...options, defaultStorage: 'fs' };
            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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

            const testOptions = { ...options, defaultStorage: 's3' };

            const res = await reconciler.reconcile({
                options: testOptions,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
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

            const testOptions = { ...options, defaultStorage: 's3' };

            const res = await reconciler.reconcile({
                options: testOptions,
                workerResources: testOptions.resources.worker,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.exist
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ limits: { cpu: 1, memory: '1024Mi' } });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ requests: { cpu: 0.5, memory: '512Mi' } });
        });
        it('should not add worker resources', async () => {
            globalSettings.applyResources = false
            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
            };

            const testOptions = { ...options, defaultStorage: 's3' };

            const res = await reconciler.reconcile({
                options: testOptions,
                workerResources: testOptions.resources.worker,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.not.exist
        });
        it('should add worker resources useLimits', async () => {
            globalSettings.useResourceLimits = true
            globalSettings.applyResources = true

            const algorithm = 'green-alg';
            algorithmTemplates[algorithm] = {
                algorithmImage: 'hkube/algorithm-example',
            };

            const testOptions = { ...options, defaultStorage: 's3' };

            const res = await reconciler.reconcile({
                options: testOptions,
                workerResources: testOptions.resources.worker,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    data: [
                        {
                            name: algorithm
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources).to.exist
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ limits: { cpu: 0.5, memory: '512Mi' } });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].resources)
                .to.deep.include({ requests: { cpu: 0.5, memory: '512Mi' } });
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
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm1 })),
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm2 })),
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm3 })),
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm4 }))
            ]
            const data = array;
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{ data }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
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
                ...Array.from(Array(800).keys()).map(() => ({ name: algorithm1 })),
                ...Array.from(Array(200).keys()).map(() => ({ name: algorithm2 })),
                ...Array.from(Array(100).keys()).map(() => ({ name: algorithm3 })),
            ]
            const workers = [
                ...Array.from(Array(70).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus })),
                ...Array.from(Array(12).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm2, workerStatus })),
                ...Array.from(Array(5).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm3, workerStatus })),
            ];
            const data = shuffle(requests);
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{ data }],
                workers,
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
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
                ...Array.from(Array(requestsAmount).keys()).map(() => ({ name: algorithm1 })),
                ...Array.from(Array(requestsAmount).keys()).map(() => ({ name: algorithm2 })),
                ...Array.from(Array(requestsAmount).keys()).map(() => ({ name: algorithm3 })),
                ...Array.from(Array(requestsAmount).keys()).map(() => ({ name: algorithm4 }))
            ]
            const workers = [
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm1, workerStatus })),
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm2, workerStatus })),
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm3, workerStatus })),
                ...Array.from(Array(workersAmount).keys()).map((k) => ({ workerId: `${algorithm1}-${k}`, workerImage, algorithmImage, algorithmName: algorithm4, workerStatus }))
            ];
            const data = shuffle(requests);
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{ data }],
                workers,
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
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
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm1 })),
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm2 })),
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm3 })),
                ...Array.from(Array(amount).keys()).map(() => ({ name: algorithm4 }))
            ]
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates,
                algorithmRequests: [{ data }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res[algorithm3].required).to.eql(res[algorithm3].created);
            expect(res[algorithm4].required).to.eql(res[algorithm4].created);
        });
    });
    describe('reconcile algorithms scheduling tests', () => {
        it('should update algorithm that cannot be schedule due to cpu', async () => {
            const algorithm = algorithmTemplates['big-cpu'];
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
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('insufficient cpu (4)');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length - 1, paused: 0, created: 0, skipped: data.length - 1, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to memory', async () => {
            const algorithm = algorithmTemplates['big-mem'];
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
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('insufficient mem (4)');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length - 1, paused: 0, created: 0, skipped: data.length - 1, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to gpu', async () => {
            const algorithm = algorithmTemplates['big-gpu'];
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
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('insufficient gpu (4)');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length - 1, paused: 0, created: 0, skipped: data.length - 1, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to max limit cpu', async () => {
            const algorithm = algorithmTemplates['max-cpu'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('maximum capacity exceeded cpu (4)');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to max limit memory', async () => {
            const algorithm = algorithmTemplates['max-mem'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('maximum capacity exceeded mem (4)');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to max limit gpu', async () => {
            const algorithm = algorithmTemplates['max-gpu'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('maximum capacity exceeded gpu (4)');
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to node selector', async () => {
            const algorithm = algorithmTemplates['node-selector'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql(`insufficient node selector (4) 'type=cpu-extreme'`);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        });
        it('should update algorithm that cannot be schedule due to all params', async () => {
            const algorithm = algorithmTemplates['node-all-params'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            const res = await reconciler.reconcile({
                options,
                normResources,
                algorithmTemplates: { [algorithm.name]: algorithm },
                algorithmRequests: [{ data }]
            });
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql(`insufficient node selector (3) 'type=gpu-extreme,max=bound', maximum capacity exceeded cpu (1), mem (1), gpu (1)`);
            expect(res).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
        });
        it('should update algorithm unschedule and then succeed to schedule', async () => {
            const algorithm = algorithmTemplates['eval-alg'];
            const data = [
                { name: algorithm.name },
                { name: algorithm.name },
                { name: algorithm.name }
            ];
            const reconcile1 = {
                options,
                normResources,
                algorithmRequests: [{ data }],
                algorithmTemplates: { [algorithm.name]: { ...algorithm, cpu: 25 } }
            };
            const reconcile2 = {
                ...reconcile1,
                algorithmTemplates: { [algorithm.name]: { ...algorithm, cpu: 1 } }
            };
            const res1 = await reconciler.reconcile(reconcile1);
            const resources = await etcd._etcd.discovery.list({ serviceName: 'task-executor' });
            const algorithms = resources && resources[0] && resources[0].unScheduledAlgorithms;
            const res2 = await reconciler.reconcile(reconcile2);
            expect(algorithms[algorithm.name].reason).to.eql('FailedScheduling');
            expect(algorithms[algorithm.name].message).to.eql('maximum capacity exceeded cpu (4)');
            expect(res1).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: 0, skipped: data.length, resumed: 0 } });
            expect(res2).to.eql({ [algorithm.name]: { idle: 0, required: data.length, paused: 0, created: data.length, skipped: 0, resumed: 0 } });
        });
    });
    describe('reconcile drivers tests', () => {
        it('should create min amount of drivers with one request', async () => {
            const idle = drivers.length;
            const count = options.driversSetting.minAmount;
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    data: [
                        {
                            name: 'pipeline-driver'
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: count, paused: 0, pending: 0, created: count, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(count);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].name).to.eql(settings.name);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/pipeline-driver');
        });
        it('should paused drivers', async () => {
            const idle = drivers.length;
            const minAmount = 5;
            const newSettings = {
                ...settings,
                minAmount
            };
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings: newSettings,
                driverTemplates,
                driversRequests: [{
                    data: [
                        {
                            name: 'pipeline-driver'
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: minAmount, paused: idle - minAmount, pending: 0, created: minAmount, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(minAmount);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].name).to.eql(settings.name);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/pipeline-driver');
        });
        it('should create min amount of drivers not enough cpu', async () => {
            const idle = drivers.length;
            const { maxAmount } = settings
            const requiredPods = 30;
            const created = 0;
            const entry = Object.entries(driverTemplates)[0];
            const newTemplate = {
                ...entry[1],
                cpu: 10
            };
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates: {
                    [entry[0]]: newTemplate
                },
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(requiredPods).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: maxAmount, paused: 0, pending: 0, created, skipped: maxAmount - created } });
        });
        it('should create min amount of drivers not enough memory', async () => {
            const idle = drivers.length;
            const { maxAmount } = settings
            const required = 30;
            const created = 0;
            const entry = Object.entries(driverTemplates)[0];
            const newTemplate = {
                ...entry[1],
                mem: 48000
            };

            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates: {
                    [entry[0]]: newTemplate
                },
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(required).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: maxAmount, paused: 0, pending: 0, created, skipped: maxAmount - created } });
        });
        it('should only create 30 in one iteration - drivers', async () => {
            const idle = drivers.length;
            const { maxAmount } = settings
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(40).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: maxAmount, paused: 0, pending: 0, created: maxAmount, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(maxAmount);
        });
        it('should scale to max amount of drivers', async () => {
            const idle = drivers.length;
            const { minAmount, scalePercent } = options.driversSetting;
            const required = minAmount;
            const requiredPods = required * 100;
            const scale = (minAmount * scalePercent) + minAmount;

            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(requiredPods).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });

            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: scale, paused: 0, pending: 0, created: scale, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(scale);
        });
    });
});
