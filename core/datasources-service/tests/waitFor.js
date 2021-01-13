/**
 * Accepts a callback that returns a boolean, executes polling on this callback
 * until it returns true or the timeout has reached
 *
 * @param {() => boolean} cb
 * @param {number=10000} timeout
 */
module.exports = (cb, timeout = 10000) =>
    new Promise((res, rej) => {
        const timeOut = setTimeout(() => reject, timeout);
        const interval = setInterval(() => {
            const cbResponse = cb();
            if (cbResponse.then) {
                cbResponse.then(r => r && resolve());
            } else if (cbResponse) {
                resolve();
            }
        }, 1000);
        const reject = () => {
            clearTimeout(timeOut);
            rej('waitFor timeout!');
        };
        const resolve = () => {
            res();
            clearInterval(interval);
            clearTimeout(timeOut);
        };
    });
