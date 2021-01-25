let stack=[]
const timeWrap = (method, instance) => {
    const methodName = method.name.startsWith('_')
        ? method.name.slice(1)
        : method.name;
    const className = instance?.constructor?.name;
    const name = `${className}::${methodName}`;

    const isAsync = method.constructor.name === 'AsyncFunction';
    if (isAsync) {
        return async (...args) => {
            const startTime=Date.now();
            stack.push(' ')
            console.log(`${stack.join('')}${name} started`)
            try {
                const ret = await method.apply(instance, args);
                console.log(`${stack.join('')}${name} took ${Date.now()-startTime}ms`)
                stack.pop()
                return ret;
            } catch (error) {
                console.log(`${stack.join('')}${name} took (error) ${Date.now()-startTime}ms`)
                stack.pop()
                throw error;
            }
        };
    }
    return (...args) => {
        const startTime=Date.now();
        stack.push(' ')
        console.log(`${stack.join('')}${name} started`)
        try {
            const ret = method.apply(instance, args);
            if (Promise.resolve(ret) == ret){
                return new Promise((res, rej)=>{
                    ret.then(r=>{
                        console.log(`${stack.join('')}${name} took ${Date.now()-startTime}ms`)
                        stack.pop()
                        res(r)
                    }).catch(r=>{
                        console.log(`${stack.join('')}${name} took (error) ${Date.now()-startTime}ms`)
                        stack.pop()
                        rej(r)
                    })
                })
            }
            console.log(`${stack.join('')}${name} took ${Date.now()-startTime}ms`)
            stack.pop()
            return ret;
        } catch (error) {
            console.log(`${stack.join('')}${name} took (error) ${Date.now()-startTime}ms`)
            stack.pop()
            throw error;
        }
    };
};

module.exports = {
    timeWrap,
};
