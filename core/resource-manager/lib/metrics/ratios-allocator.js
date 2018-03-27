

/**
 * 
 * 
 * @class RatiosAllocator
 */
class RatiosAllocator {

    constructor({ ratios, prop, group }) {
        this._ratio = 0;
        this._allocations = 0;
        this._ratios = ratios;
        this._prop = prop;
        this._group = group;
        this._calcRatios();
    }

    _calcRatios() {
        const ratioSum = this._ratios.map(v => v[this._prop]).reduce((a, b) => a + b, 0);
        this._ratios = this._ratios.map(v => ({ ...v, ratio: 1 - (v[this._prop] / ratioSum) }));
        const newRatioSum = this._ratios.map(v => v.ratio).reduce((a, b) => a + b, 0);
        this._ratios = this._ratios.map(v => ({ ...v, ratio: (v.ratio / newRatioSum) }));
        this._calcRange();
    }

    _calcRange() {
        this._ratio = 0;
        this._allocations = 0;
        this._ratios.forEach((r, i) => {
            const type = this._group[r.algorithmName];
            const allocations = (type && type.length) || 0;
            this._ratio += r.ratio;
            r.allocations = r.allocations || allocations;
            r.range = { from: i > 0 ? this._ratios[i - 1].range.to + 0.000001 : 0, to: this._ratio };
            this._allocations += r.allocations;
        });
    }

    *generate() {
        while (this._allocations > 0) {
            const random = Math.random();
            let algorithm = this._findRange(random);
            if (algorithm.allocations === 0) {
                this._ratios = this._ratios.filter(r => r.algorithmName !== algorithm.algorithmName);
                const div = algorithm.ratio / this._ratios.length;
                this._ratios.forEach(r => {
                    r.ratio += div;
                });
                this._calcRange();
                algorithm = this._findRange(random);
            }
            algorithm.allocations--;
            this._allocations--;
            yield algorithm;
        }
    }

    _findRange(range) {
        return this._ratios.find(r => range >= r.range.from && range <= r.range.to);
    }
}

module.exports = RatiosAllocator;