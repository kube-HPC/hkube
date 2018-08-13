/**
 * Create generic ratio for specific algorithm and then generate 
 * random number between 0-1 to find algorithm that match this ratio
 * 
 * @class AlgorithmRatios
 */
class AlgorithmRatios {
    constructor({ algorithms, allocations }) {
        this._ratio = 0;
        this._totalAllocations = 0;
        this._algorithms = algorithms;
        this._allocations = allocations;
        this._calcRatios();
    }

    _calcRatios() {
        const ratioSum = this._algorithms.map(v => v.value).reduce((a, b) => a + b, 0);
        this._algorithms = this._algorithms.map(v => ({ ...v, ratio: 1 - (v.value / ratioSum) }));
        const newRatioSum = this._algorithms.map(v => v.ratio).reduce((a, b) => a + b, 0);
        this._algorithms = this._algorithms.map(v => ({ ...v, ratio: (v.ratio / newRatioSum) }));
        this._calcRange();
    }

    _calcRange() {
        this._ratio = 0;
        this._totalAllocations = 0;
        this._algorithms.forEach((r, i) => {
            const allocations = this._allocations[r.name];
            this._ratio += r.ratio;
            r.allocations = r.allocations || allocations;
            r.range = {
                from: i > 0 ? this._algorithms[i - 1].range.to : 0,
                to: this._ratio
            };
            this._totalAllocations += r.allocations;
        });
    }

    * generateRandom() {
        while (this._totalAllocations > 0) {
            const random = parseFloat(Math.random().toFixed(4));
            let algorithm = this._findRange(random);
            if (algorithm.allocations === 0) {
                this._reCalcRange(algorithm);
                algorithm = this._findRange(random);
            }
            algorithm.allocations -= 1;
            this._totalAllocations -= 1;
            yield algorithm;
        }
    }

    _reCalcRange(algorithm) {
        this._algorithms = this._algorithms.filter(r => r.name !== algorithm.name);
        const div = algorithm.ratio / this._algorithms.length;
        this._algorithms.forEach(r => {
            r.ratio += div;
        });
        this._calcRange();
    }

    _findRange(range) {
        return this._algorithms.find(r => range >= r.range.from && range <= r.range.to);
    }
}

module.exports = AlgorithmRatios;
