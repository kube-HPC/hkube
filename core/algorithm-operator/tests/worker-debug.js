const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
const { createKindsSpec } = require('../lib/deployments/worker-debug.js');
const { settings } = require('../lib/helpers/settings');

describe('jobCreator', () => {
    describe('createKindsSpec', () => {
        it('should throw if no algorithm name', () => {
            expect(() => createKindsSpec({ algorithmName: '', options })).to.throw('Unable to create deployment spec. algorithmName is required');
        });
        it('should apply all required properties', () => {
            const versions = {
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v1.2.3"
                    }
                ]
            };
            const { deploymentSpec, ingressSpec } = createKindsSpec({ algorithmName: 'myalgo1', options, versions });
            expect(deploymentSpec).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(deploymentSpec).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:v1.2.3' });
            expect(deploymentSpec.metadata.name).to.include('myalgo1');
            expect(ingressSpec.spec.rules[0].host).to.be.undefined;
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/debug/myalgo1' });
        });
        it('create job with volume', () => {
            const res = createKindsSpec({ algorithmName: 'myalgo1', options: { defaultStorage: 'fs', kubernetes: {} } }).deploymentSpec;
            expect(res.spec.template.spec).to.have.property('volumes');
            expect(res.spec.template.spec.containers[0]).to.have.property('volumeMounts');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res.metadata.name).to.include('myalgo1');
        });
        it('should apply jaeger privileged', () => {
            const res = createKindsSpec({ algorithmName: 'myalgo1', options: { defaultStorage: 'fs', kubernetes: { isPrivileged: true } } }).deploymentSpec;
            expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.have.property('valueFrom')
        });
        it('should apply jaeger not privileged', () => {
            const res = createKindsSpec({ algorithmName: 'myalgo1', options: { defaultStorage: 'fs', kubernetes: { isPrivileged: false } } }).deploymentSpec;
            expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.be.undefined;
        });
        it('should apply jaeger not privileged with external agent', () => {
            const res = createKindsSpec({ algorithmName: 'myalgo1', options: { defaultStorage: 'fs', jaeger: { host: 'foo.bar' }, kubernetes: { isPrivileged: false } } }).deploymentSpec;
            expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST').value).to.eql('foo.bar');
        });
        it('should use ingress host name', () => {
            const versions = {
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v1.2.3"
                    }
                ]
            };
            const clusterOptions = {
                ingressHost: 'foo.bar.com',
                ingressPrefix: '/myprefix'
            }
            const { deploymentSpec, ingressSpec } = createKindsSpec({ algorithmName: 'myalgo1', options, versions, clusterOptions });
            expect(deploymentSpec).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(deploymentSpec).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:v1.2.3' });
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': clusterOptions.ingressHost });
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': `${clusterOptions.ingressPrefix}/hkube/debug/myalgo1` });
            expect(ingressSpec.metadata.annotations["nginx.ingress.kubernetes.io/rewrite-target"]).to.eql('/');
        });
        it('should use ingress regex', () => {
            const versions = {
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v1.2.3"
                    }
                ]
            };
            const clusterOptions = {
                ingressHost: 'foo.bar.com',
                ingressPrefix: '/myprefix',
                ingressUseRegex: 'true'
            }
            const { deploymentSpec, ingressSpec } = createKindsSpec({ algorithmName: 'myalgo1', options, versions, clusterOptions });
            expect(deploymentSpec).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(deploymentSpec).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:v1.2.3' });
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': clusterOptions.ingressHost });
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': `${clusterOptions.ingressPrefix}/hkube/debug/myalgo1(/|$)(.*)` });
            expect(ingressSpec.metadata.annotations["nginx.ingress.kubernetes.io/rewrite-target"]).to.eql('/$2');
        });

        it('should add imagePullSecret', () => {
            const versions = {
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v1.2.3"
                    }
                ]
            };
            const clusterOptions = {
                ingressHost: 'foo.bar.com',
                ingressPrefix: '/myprefix',
                ingressUseRegex: 'true',
                imagePullSecretName: 'my-secret'
            }
            const { deploymentSpec, ingressSpec } = createKindsSpec({ algorithmName: 'myalgo1', options, versions, clusterOptions });
            expect(deploymentSpec.spec.template.spec.imagePullSecrets).to.exist;
            expect(deploymentSpec.spec.template.spec.imagePullSecrets[0]).to.eql({ name: 'my-secret' });
        });

    });
    describe('sidecars', () => {
        before(() => {
            settings.sidecars = [{
                name: 'my-sidecar',
                container: [
                    { name: 'c1', image: 'foo/bar' },
                    { name: 'c2', image: 'foo/bar' }
                ],
                volumes: [
                    {
                        name: "v1",
                        emptyDir: {}
                    },
                    {
                        name: "v2",
                        configMap: {
                            name: "cm2"
                        }
                    }
                ],
                volumeMounts: [
                    {
                        name: "v2",
                        mountPath: '/tmp/foo'
                    }

                ],
                environments: [
                    {
                        name: "env1",
                        value: "val1"
                    },
                    {
                        name: "env2",
                        value: "val2"
                    }
                ]

            }]
        })
        after(() => {
            settings.sidecars = []
        });
        it('should not apply sidecar if not enabled', () => {
            const { deploymentSpec, ingressSpec } = createKindsSpec({ algorithmName: 'myalgo1', options });
            expect(deploymentSpec.spec.template.spec.containers).to.have.lengthOf(1)
        });
        it('should apply sidecar if enabled', () => {
            const { deploymentSpec: res } = createKindsSpec({ algorithmName: 'myalgo1', options: { kubernetes: {} }, clusterOptions: { "my-sidecarSidecarEnabled": true } });

            expect(res.spec.template.spec.containers).to.have.lengthOf(3)
            expect(res.spec.template.spec.containers[1].name).to.eql('c1')
            expect(res.spec.template.spec.containers[2].name).to.eql('c2')
            expect(res.spec.template.spec.volumes).to.deep.include(settings.sidecars[0].volumes[0])
            expect(res.spec.template.spec.volumes).to.deep.include(settings.sidecars[0].volumes[1])
            expect(res.spec.template.spec.containers[0].volumeMounts).to.deep.include(settings.sidecars[0].volumeMounts[0])
            expect(res.spec.template.spec.containers[0].env).to.deep.include(settings.sidecars[0].environments[0])
            expect(res.spec.template.spec.containers[0].env).to.deep.include(settings.sidecars[0].environments[1])
            expect(res.spec.template.spec.containers[1].env).to.not.exist;
        });
        it('should not apply sidecar if no sidecar configmap', () => {
            const { deploymentSpec: res } = createKindsSpec({ algorithmName: 'myalgo1', options: { kubernetes: {} }, clusterOptions: { "no-sidecarSidecarEnabled": true } });
            expect(res.spec.template.spec.containers).to.have.lengthOf(1)
        });
    })
});
