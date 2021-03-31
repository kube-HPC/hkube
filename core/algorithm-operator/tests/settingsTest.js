const { expect } = require('chai');
const {settings, setFromConfig} = require('../lib/helpers/settings');

describe('setting tests', () => {
    it('should init from config', () => {
        expect(settings.applyResourceLimits).to.be.false;
        setFromConfig({
            resources: {
                enable: true
            },
            kubernetes: {

            }
        });
        expect(settings.applyResourceLimits).to.be.true;
    });
});