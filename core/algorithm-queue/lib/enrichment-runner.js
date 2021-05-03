const enrichments = require('./enrichments/index');
class EnrichmentRunner {
    constructor() {
        this.enrichmentMap = [];
        Object.values(enrichments).map(v => this.addEnrichments(v));
    }

    addEnrichments(enrichment) {
        this.enrichmentMap.push(enrichment);
    }

    async run(queue) {
        this.enrichmentMap.forEach(e => e(queue));
    }
}

module.exports = EnrichmentRunner;
