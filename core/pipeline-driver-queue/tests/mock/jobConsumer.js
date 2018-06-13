const packageName = '@hkube/producer-consumer';
const mockery = require('mockery');

const consumer = () => {
    let callback = null;
    return {
        Consumer: function () {
            return {
                register: (...rest) => ({ ...rest }),
                on: (name, _callback) => {
                    callback = _callback;
                },
                _emit: obj => {
                    if (callback) {
                        callback({ data: { ...obj } });
                    }
                    else {
                        console.log('blaaaaaa');
                    }
                }
            };
        }
    };
};

module.exports = {

    register: () => {
        const _jobConsumer = consumer();
        mockery.registerMock(packageName, _jobConsumer);
        return _jobConsumer;
    },
    deregister: () => mockery.deregisterMock(packageName),
};
