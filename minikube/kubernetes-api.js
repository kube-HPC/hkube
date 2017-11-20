
const Api = require('kubernetes-client');
const { callDone, done, semaphore } = require('await-done');
const { spawn, execSync, spawnSync } = require('child_process');
const syncSpawn = require('./sync-spawn');
const JSONStream = require('json-stream');
const colors = require('colors');
const jsYaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');
class kubernetesApi {
    constructor() {
        this.config = Api.config.fromKubeconfig();
        this.config.promises = true;
        this.core = new Api.Core(this.config);
    }

    async listenToK8sStatus(podName, status) {
        let sema = new semaphore();
        const jsonStream = new JSONStream();
        try {
            let stream = await this.core.ns(`default`).pods(``).getStream({ qs: { watch: true } });

            if (stream) {
                console.log(`kubernetes: wait for pod ${podName} to be in status ${status}`.magenta);
                stream.pipe(jsonStream);
                jsonStream.on('data', chunk => {
                    if (chunk.object.metadata.name.includes(podName)) {
                        if (chunk.object.status.phase == status) {
                            jsonStream.removeAllListeners('data');
                            sema.callDone();
                            stream.abort();
                            // stream = null;
                            console.log(`kubernetes: pod ${podName} in  now in status ${status}`.magenta);
                        }
                    }
                });
                await sema.done();
                jsonStream.removeAllListeners('data');
                stream.abort();
                console.log(`kubernetes: pod ${podName} cleares all listeners`.magenta);

            }

        } catch (error) {
            console.log(error);
        }
    }





    async createPodsSync(yamlPath) {
        let files = fs.readdirSync(yamlPath)
        for (var file of files) {
            let yml = jsYaml.safeLoad(fs.readFileSync(path.join(yamlPath, file), 'utf8'));
            //console.log(`run kubectl create -f ${file}`);
            let deploymentName = yml.metadata.name;
            await syncSpawn(`kubectl`, `apply -f ${yamlPath}/${file} `)
            await this.listenToK8sStatus(deploymentName, `Running`)
        }

    }

}

module.exports = new kubernetesApi();