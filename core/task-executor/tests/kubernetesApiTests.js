const { expect } = require('chai');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const KubernetesApi = require('../lib/helpers/kubernetes').KubernetesApi;
const kubernetesServerMock = require('./mocks/kubernetes-server.mock');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const sinon = require('sinon');

let instance;

const kubeconfig = main.kubernetes.kubeconfig;

const dummyKubeconfig = {
    ...kubeconfig,
    clusters: [{
        name: 'test',
        cluster: {
            server: "no.such.url"
        }
    }]
};

const options = {
    kubernetes: {
        kubeconfig
    },
    resources: { defaultQuota: {} },
    healthchecks: { logExternalRequests: false }


};

const optionsDummy = {
    kubernetes: {
        kubeconfig: dummyKubeconfig
    },
    resources: { defaultQuota: {} },
    healthchecks: { logExternalRequests: false }
};

describe('Kubernetes API', () => {
    before(async () => {
        await kubernetesServerMock.start({ port: 9001 });
    });
    beforeEach(async () => {
        instance = new KubernetesApi();
        await instance.init(options);
    });
    it('should create job', async () => {
        const res = await instance.createJob({ spec: { metadata: { name: 'mySpec' } } });
        expect(res.body.metadata.name).to.eql('mySpec');
    });
    it('should get worker jobs', async () => {
        const res = await instance.getWorkerJobs();
        expect(res.statusCode).to.eql(200);
    });
    it('should get worker for job', async () => {
        const res = await instance.getPodsForJob({ spec: { selector: { matchLabels: 'myLabel=mySelector' } } });
        expect(res.statusCode).to.eql(200);
    });
    it('should fail to get worker for job if no selector', async () => {
        const res = await instance.getPodsForJob({ spec: { selector: { matchLabels: null } } });
        expect(res).to.be.empty
    });
    it('should fail to get worker for job if no job spec', async () => {
        const res = await instance.getPodsForJob();
        expect(res).to.be.empty
    });
    it('should get config map', async () => {
        const res = await instance.getVersionsConfigMap();
        expect(res).to.have.property('versions');
        expect(res).to.have.property('registry');
        expect(res).to.have.property('clusterOptions');
    });
    it('should throw', async () => {
        const res = instance.init(optionsDummy);
        expect(res).to.be.rejectedWith('Invalid URI "no.such.url/version"');
    });
    it('should get nodes and pods', async () => {
        const res = await instance.getResourcesPerNode();
        expect(res).to.have.property('pods')
        expect(res).to.have.property('nodes')
    });
    it('should get all PVC names', async () => {
        const res = await instance.getAllPVCNames();
        expect(res).to.be.an('array').that.includes('pvc-1', 'pvc-2');
    });
    it('should get all ConfigMap names', async () => {
        const res = await instance.getAllConfigMapNames();
        expect(res).to.be.an('array').that.includes('config-map-1', 'config-map-2');
    });
    it('should get all Secret names', async () => {
        const res = await instance.getAllSecretNames();
        expect(res).to.be.an('array').that.includes('secret-1', 'secret-2');
    });
    it('should get all Kai Queues names', async () => {
        kubernetesServerMock.setKaiCRDEnabled(true);
        const res = await instance.getAllQueueNames();
        expect(res).to.be.an('array').that.includes('test', 'default');
    });
    it('should return empty list when Kai CRD is missing', async () => {
        kubernetesServerMock.setKaiCRDEnabled(false);
        const res = await instance.getAllQueueNames();
        expect(res).to.be.an('array').that.is.empty;
    });
    it('should log missing CRD warning only once', async () => {
        kubernetesServerMock.setKaiCRDEnabled(false);
        const Logger = require('@hkube/logger');
        const log1 = Logger.GetLogFromContainer();

        const logSpy = sinon.spy(log1, 'info');

        await instance.getAllQueueNames();
        await instance.getAllQueueNames();
        const matchingLogs = logSpy.getCalls().filter(call =>
            call.args[0].includes('Kai Queues CRD') && call.args[0].includes('not found')
        );

        expect(matchingLogs.length).to.equal(1);
    });
});
