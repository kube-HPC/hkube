const { expect } = require('chai');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const KubernetesApi = require('../lib/helpers/kubernetes').KubernetesApi;
const kubernetesServerMock = require('./mocks/kubernetes-server.mock');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

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
        instance.init(options);
    });
    it('should create job', async () => {
        const res = await instance.createJob({ spec: { metadata: { name: 'mySpec' } } });
        expect(res.body.metadata.name).to.eql('mySpec');
    });
    it('should return null of job creation failed', async () => {
        await instance.init(optionsDummy);
        const res = await instance.createJob({ spec: { metadata: { name: 'mySpec' } } });
        expect(res).to.be.null;
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
        await instance.init(optionsDummy);
        const res = instance.getVersionsConfigMap();
        expect(res).to.be.rejectedWith('Invalid URI "no.such.url/api/v1/namespaces/default/configmaps/hkube-versions"');
    });
    it('should get nodes and pods', async () => {
        const res = await instance.getResourcesPerNode();
        expect(res).to.have.property('pods')
        expect(res).to.have.property('nodes')
    });
});
