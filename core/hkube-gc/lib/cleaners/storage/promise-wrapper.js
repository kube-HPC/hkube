const promiseWrapper = (func) => {
    return new Promise((resolve) => {
        func().then((value) => {
            resolve(value);
        }).catch(error => resolve(error));
    });
};

module.exports = promiseWrapper;
