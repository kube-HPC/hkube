const stack = [];
const timeWrap = (method, instance) => {
    const methodName = method.name.startsWith('_')
        ? method.name.slice(1)
        : method.name;
    const className = instance?.constructor?.name;
    const name = `${className}::${methodName}`;

    const isAsync = method.constructor.name === 'AsyncFunction';
    if (isAsync) {
        return async (...args) => {
            const startTime = Date.now();
            stack.push(' ');
            console.info(`${stack.join('')}${name} started`);
            try {
                const ret = await method.apply(instance, args);
                console.info(
                    `${stack.join('')}${name} took ${Date.now() - startTime}ms`
                );
                stack.pop();
                return ret;
            } catch (error) {
                console.info(
                    `${stack.join('')}${name} took (error) ${
                        Date.now() - startTime
                    }ms`
                );
                stack.pop();
                throw error;
            }
        };
    }
    return (...args) => {
        const startTime = Date.now();
        stack.push(' ');
        console.info(`${stack.join('')}${name} started`);
        try {
            const ret = method.apply(instance, args);
            if (Promise.resolve(ret) === ret) {
                return new Promise((res, rej) => {
                    ret.then(r => {
                        console.info(
                            `${stack.join('')}${name} took ${
                                Date.now() - startTime
                            }ms`
                        );
                        stack.pop();
                        res(r);
                    }).catch(r => {
                        console.info(
                            `${stack.join('')}${name} took (error) ${
                                Date.now() - startTime
                            }ms`
                        );
                        stack.pop();
                        rej(r);
                    });
                });
            }
            console.info(
                `${stack.join('')}${name} took ${Date.now() - startTime}ms`
            );
            stack.pop();
            return ret;
        } catch (error) {
            console.info(
                `${stack.join('')}${name} took (error) ${
                    Date.now() - startTime
                }ms`
            );
            stack.pop();
            throw error;
        }
    };
};

const Trace = (obj, methodNames) =>
    methodNames.forEach(method => {
        // eslint-disable-next-line
        obj[method] = timeWrap(obj[method], obj);
    });

module.exports = {
    timeWrap,
    Trace,
};
