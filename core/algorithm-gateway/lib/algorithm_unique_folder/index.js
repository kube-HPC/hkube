
const RestServer = require('@hkube/rest-server');
const { swaggerUtils } = require('@hkube/rest-server');
const rest = new RestServer();
const sleep = d => new Promise(r => setTimeout(r, d * 1000));
let active = false;

const as = async () => {
    const opt = {
        swagger,
        routes,
        prefix,
        versions,
        port: parseInt(port, 10),
        rateLimit,
        poweredBy,
        name: options.serviceName,
        beforeRoutesMiddlewares,
        afterRoutesMiddlewares: [...afterRoutesMiddlewares, afterRequest(routeLogBlacklist)]
    };
    const data = await rest.start(opt);
}


const stream = async (hkubeApi, options, nodeInput) => {

    console.log(`started stateful stream with ${msgPerSec} msg per second`)

    return new Promise(async (resolve, reject) => {
        try {
            while (active) {
                if (sleepOptions.enable && (Date.now() - sleepOptions.lastSleep) > (sleepOptions.sleepEach / 1000)) {
                    sleepOptions.lastSleep = Date.now();
                    await sleep(sleepOptions.sleepFor);
                }
                if (burstOptions.enable) {

                }
                flows.forEach(f => hkubeApi.sendMessage(obj, f));
                await sleep(sleepTime);
                count += 1;
                if (count === totalMessages) {
                    console.log(`finish sending ${count} messages`)
                    await sleep(300);
                    return resolve();
                }
            }
            return resolve();
        }
        catch (e) {
            return reject(e);
        }
    });
}


const start = async (options, hkubeApi) => {
    active = true;
    const nodeInput = options.input[0];


    await stream(hkubeApi, options, nodeInput)


    return nodeInput;
}

const stop = async () => {
    active = false;
}

module.exports = { start };
