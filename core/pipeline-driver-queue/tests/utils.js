const requestClient = require('request');



const delay = (d) => new Promise((r) => setTimeout(r, d));

const request = (options) => {
    return new Promise((resolve, reject) => {
        const method = options.method || 'POST';
        requestClient(
            {
                ...options,
                method,
                json: true
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

module.exports = {
    delay,
    request
};
