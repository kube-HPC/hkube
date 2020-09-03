/**
 * Just a generic wrapper for the standard interval
 */
class Interval {
    constructor(options) {
        this._active = false;
        this._interval = null;
        this._delay = options.delay;
    }

    start() {
        if (this._interval) {
            return this;
        }
        this._interval = setInterval(async () => {
            if (this._active) {
                return;
            }
            try {
                this._active = true;
                await this._onFunc();
            }
            catch (e) {
                if (this._onError) {
                    this._onError(e);
                }
            }
            finally {
                this._active = false;
            }
        }, this._delay);

        return this;
    }

    stop() {
        this._active = false;
        clearInterval(this._interval);
        this._interval = null;
        return this;
    }

    onFunc(func) {
        this._onFunc = func;
        return this;
    }

    onError(func) {
        this._onError = func;
        return this;
    }
}

module.exports = Interval;
