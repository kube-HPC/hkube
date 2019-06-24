const { expect } = require('chai');
const formatters = require('../lib/helpers/formatters');

describe('formatters', () => {
    it('should parse bool true', () => {
        expect(formatters.parseBool(true)).to.be.true;
        expect(formatters.parseBool(true,false)).to.be.true;
        expect(formatters.parseBool('true')).to.be.true;
        expect(formatters.parseBool('TRUE',false)).to.be.true;
        expect(formatters.parseBool('true',true)).to.be.true;
        expect(formatters.parseBool('TRUE',true)).to.be.true;
        expect(formatters.parseBool(undefined,true)).to.be.true;
        expect(formatters.parseBool(null,true)).to.be.true;
    });
    it('should parse bool false', () => {
        expect(formatters.parseBool(false)).to.not.be.true;
        expect(formatters.parseBool(false,true)).to.not.be.true;
        expect(formatters.parseBool('false')).to.not.be.true;
        expect(formatters.parseBool('FALSE',true)).to.not.be.true;
        expect(formatters.parseBool('foo',true)).to.not.be.true;
        expect(formatters.parseBool(undefined,false)).to.not.be.true;
        expect(formatters.parseBool(null,false)).to.not.be.true;
    });
    
});