const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
const { createKindsSpec } = require('../lib/deployments/worker-debug.js');

describe('jobCreator', () => {
    describe('createKindsSpec', () => {
        it('should throw if no algorithm name', () => {
            expect(() => createKindsSpec({ algorithmName: '', options })).to.throw('Unable to create deployment spec. algorithmName is required');
        });
        it('should apply all required properties', () => {
            const res = createKindsSpec({ algorithmName: 'myalgo1', options }).deploymentSpec;
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:latest' });
            expect(res.metadata.name).to.include('myalgo1');
        });
        it('create job with volume', () => {
            const res = createKindsSpec({ algorithmName: 'myalgo1', options: { defaultStorage: 'fs' } }).deploymentSpec;
            expect(res.spec.template.spec).to.have.property('volumes');
            expect(res.spec.template.spec.containers[0]).to.have.property('volumeMounts');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res.metadata.name).to.include('myalgo1');
        });
    });
});
