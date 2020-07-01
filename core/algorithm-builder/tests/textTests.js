const { expect } = require('chai');
const {redactLines} = require('../lib/utils/text');
const fs = require('fs')
const inputFile = fs.readFileSync(__dirname + '/mocks/longLog.json','utf-8');
const inputStr = JSON.parse(inputFile).result.data;
describe('text tests', () => {
    it('redact empty string', () => {
        const str = '';
        const res = redactLines(str);        
        expect(res).to.be.empty
    });
    it('not redact short string', () => {
        const str = 'foo bar';
        const res = redactLines(str);        
        expect(res).to.eql(str)
    });
    it('redact long string', () => {
        const str = inputStr.slice(0,-1);
        const res = redactLines(str);
        const lines = res.split(/\n/);
        expect(lines).to.have.length(503)
    });
});