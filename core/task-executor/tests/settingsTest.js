const { expect } = require('chai');
const {settings, setFromConfig} = require('../lib/helpers/settings');

describe('setting tests', () => {
    it('should init from config', () => {
        expect(settings.applyResources).to.be.false;
        setFromConfig({
            resources: {
                enable: true
            },
            kubernetes: {

            }
        });
        expect(settings.applyResources).to.be.true;
    });
});