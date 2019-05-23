class EnrichmentRunner {
    constructor() {
        this.enrichmentMap = [];
    }

    addEnrichments(enrichment) {
        this.enrichmentMap.push(enrichment);
    }

    async run(queue) {
        this.enrichmentMap.forEach(e => e(queue));
    }
}

module.exports = EnrichmentRunner;
