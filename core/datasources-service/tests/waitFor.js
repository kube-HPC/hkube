// @ts-nocheck
/**
 * Accepts a callback that returns a boolean, executes polling on this callback until it returns
 * true or the timeout has reached.
 *
 * @param {() => boolean | Promise<boolean>} cb
 * @param {number}                           [timeout]
 */
module.exports = (cb, timeout = 10000) =>
    new Promise((res, rej) => {
        const timeOut = setTimeout(() => reject, timeout);
        const interval = setInterval(() => {
            const cbResponse = cb();
            if (cbResponse.then) {
                cbResponse.then(r => r && resolve());
                cbResponse.catch(reject);
            } else if (cbResponse === true) {
                resolve();
            }
        }, 1000);
        const reject = () => {
            clearTimeout(timeOut);
            rej('waitFor timeout!');
        };
        const resolve = () => {
            clearInterval(interval);
            clearTimeout(timeOut);
            res();
        };
    });
