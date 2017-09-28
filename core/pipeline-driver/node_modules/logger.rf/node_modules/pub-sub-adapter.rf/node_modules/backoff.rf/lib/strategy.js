/*
 * Created by nassi on 08/03/17.
 */

'use strict';

const DEFAULT_STRATEGY = 'fixed';

const strategies = {
    fixed: (delay) => {
        return delay;
    },
    linear: (delay, attempt) => {
        return attempt * delay;
    },
    expo: (delay, attempt) => {
        return Math.round(Math.pow(1.5, attempt) * delay);
    },
    fibo: (delay, attempt) => {
        let prev = 1, current = 0, temp;
        while (attempt > 0) {
            temp = prev;
            prev = prev + current;
            current = temp;
            attempt--
        }
        return current * delay;
    }
};

const create = strategy => delay => attempt => {
    strategy = strategies.hasOwnProperty(strategy) ? strategy : DEFAULT_STRATEGY;
    let strategyFunction = strategies[strategy];
    return strategyFunction(delay, attempt);
};

module.exports.create = create;

