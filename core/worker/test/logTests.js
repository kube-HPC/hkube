const { expect } = require('chai');
const loggingProxy = require('../lib/algorithm-logging/logging-proxy');
describe('log tests', () => {
    it('should match cri logs', () => {
        const msg = '2022-05-30T13:29:54.884046275Z stdout F starting algorithm runner';
        const res = loggingProxy._getLogMessage(msg);
        expect(res.logMessage).to.eql('starting algorithm runner');
        expect(res.stream).to.eql('stdout');
    });
    it('should match docker logs', () => {
        const msg = 'starting algorithm runner';
        const res = loggingProxy._getLogMessage(msg);
        expect(res.logMessage).to.eql('starting algorithm runner');
        
    });
    it('should match docker logs json', () => {
        const msg = '{"log":"starting algorithm runner","stream":"stdout","time":"2022-05-30T14:02:22.112200589Z"}';
        const res = loggingProxy._getLogMessage(msg);
        expect(res.logMessage).to.eql('starting algorithm runner');
        
    });
});