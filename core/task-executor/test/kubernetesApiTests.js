const { expect } = require('chai');
const mockery = require('mockery');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { callCount, mock, clearCount } = (require('./mocks/kubernetesClient.mock')).kubernetesClient();
let KubernetesApi;

describe('Kubernetes API', () => {
    before(async () => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: false
        });
        mockery.registerMock('kubernetes-client', mock);
        KubernetesApi = require('../lib/helpers/kubernetes').KubernetesApi;
    });
    after(() => {
        mockery.disable();
    });
    it('should create class without error', () => {
        const instance = new KubernetesApi();
        expect(instance).to.exist;
    });
    it('should init with kube config', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        expect(instance).to.exist;
    });
    it('should create job', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {
            }
        };
        await instance.init(options);
        const res = await instance.createJob({ spec: { metadata: { name: 'mySpec' } } });
        expect(res.body.metadata.name).to.eql('mySpec');

    });
    it('should return null of job creation failed', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        instance._client.shouldThrow = true
        const res = await instance.createJob({ spec: { metadata: { name: 'mySpec' } } });
        expect(res).to.be.null;
    });
    it('should delete job', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.deleteJob('myJobName');
        expect(res.deleted).to.eql('myJobName');

    });
    it('should return null if delete job fails', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        instance._client.shouldThrow = true
        const res = await instance.deleteJob('myJobName');
        expect(res).to.be.null;
    });
    it('should get worker jobs', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.getWorkerJobs();
        expect(res.get.qs.labelSelector).to.eql('type=worker,group=hkube');

    });
    it('should get worker for job', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.getPodsForJob({ spec: { selector: { matchLabels: 'myLabel=mySelector' } } });
        expect(res.getPod.qs.labelSelector).to.eql('myLabel=mySelector');

    });
    it('should fail to get worker for job if no selector', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.getPodsForJob({ spec: { selector: { matchLabels: null } } });
        expect(res).to.be.empty

    });
    it('should fail to get worker for job if no job spec', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.getPodsForJob();
        expect(res).to.be.empty

    });
    it('should get config map', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.getVersionsConfigMap();
        expect(res.name).to.eql('hkube-versions');

    });
    it('should throw', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        instance._client.shouldThrow = true
        const res = await instance.getVersionsConfigMap();
        expect(res).to.be.null
    });
    it('should get nodes and pods', async () => {
        const instance = new KubernetesApi();
        const options = {
            kubernetes: {

            }
        };
        await instance.init(options);
        const res = await instance.getResourcesPerNode();
        expect(res).to.have.property('pods')
        expect(res).to.have.property('nodes')
    });
});
