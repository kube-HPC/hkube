const requestClient = require('request');

const defaultProps = {
    mem: '256Mi',
    cpu: 0.1,
    type: 'Image',
    minHotWorkers: 0,
    options: {
        debug: false,
        pending: false,
    },
};

const delay = d => new Promise(r => setTimeout(r, d));

/** @param {import('request').CoreOptions & { uri: string }} options */
const request = options => {
    return new Promise((resolve, reject) => {
        const method = options.method || 'POST';
        requestClient(
            {
                ...options,
                method,
                json: true,
            },
            (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                return resolve({ body, response });
            }
        );
    });
};

module.exports = { delay, request, defaultProps };
