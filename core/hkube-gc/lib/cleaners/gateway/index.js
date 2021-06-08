const { nodeKind } = require('@hkube/consts');
const kindCleaner = require('../../core/kind-cleaner');
const BaseCleaner = require('../../core/base-cleaner');

class Cleaner extends BaseCleaner {
    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await kindCleaner.delete({ data, kind: nodeKind.Gateway });
        this.setResultCount(data.length);
        return this.getStatus();
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult(data);
    }

    async fetch({ maxAge } = {}) {
        const maxJobAge = this.resolveMaxAge(maxAge, this._config.maxAge);
        const algorithms = await kindCleaner.fetch({ kind: nodeKind.Gateway, maxAge: maxJobAge });
        return algorithms;
    }
}

module.exports = Cleaner;
