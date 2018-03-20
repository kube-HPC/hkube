
const Metric = require('./Metric');
const MAX_CPU = 32000;

class TemplatesStoreMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(data) {
        let algorithmQueue = data.algorithmQueue.map(q => {
            const { cpu, mem } = data.templatesStore[q.alg];
            return {
                ...q,
                score: q.score * this.weight * this._normalize(cpu)
            }
        });
        const result = {
            ...data,
            algorithmQueue
        }
        return result;
    }

    _normalize(cpu) {
        return (cpu < MAX_CPU ? MAX_CPU - cpu : MAX_CPU) / MAX_CPU;
    }
}

module.exports = TemplatesStoreMetric;