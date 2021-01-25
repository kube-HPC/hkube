const timeWrap = (method, instance) => {
    const methodName = method.name.startsWith('_')
        ? method.name.slice(1)
        : method.name;
    const className = instance.constructor.name;
    const name = `${className}::${methodName}`;

    const isAsync = method.constructor.name === 'AsyncFunction';
    if (isAsync) {
        return async (...args) => {
            const startTime=Date.now();
            console.log(`${name} started`)
            try {
                const ret = await method.apply(instance, args);
                console.log(`${name} took ${Date.now()-startTime}ms`)
                return ret;
            } catch (error) {
                console.log(`${name} took (error) ${Date.now()-startTime}ms`)
                throw error;
            }
        };
    }
    return (...args) => {
        const startTime=Date.now();
        console.log(`${name} started`)
        try {
            const ret = method.apply(instance, args);
            if (Promise.resolve(ret) == ret){
                return new Promise((res, rej)=>{
                    ret.then(r=>{
                        console.log(`${name} took ${Date.now()-startTime}ms`)
                        res(r)
                    }).catch(r=>{
                        console.log(`${name} took (error) ${Date.now()-startTime}ms`)
                        rej(r)
                    })
                })
            }
            console.log(`${name} took ${Date.now()-startTime}ms`)
            return ret;
        } catch (error) {
            console.log(`${name} took (error) ${Date.now()-startTime}ms`)

            throw error;
        }
    };
};

module.exports = {
    timeWrap,
};
