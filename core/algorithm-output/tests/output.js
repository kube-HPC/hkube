const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const { expect } = require('chai');
const { uuid } = require('@hkube/uid');


const jobData = {
    jobId: uuid(),
    taskId: uuid(),
    input: ["return value"],
    kind: 'batch',
    nodeName: 'A',
    childs: [],
}


describe('inout', () => {
    it('should throw no such flow', async () => {
        const app = require('../lib/app');
        const wrapper = app.getWrapper();
        await wrapper._stop({});
        wrapper._handleResponse = (algorithmData) => {
            expect(algorithmData.length).to.eq(1, 'wrong return value');
            expect(algorithmData[0]).to.eq('return value', 'wrong return value');
        }
        wrapper._init(jobData);
        wrapper._start({});

    });

});

