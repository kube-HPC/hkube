
const Api = require('kubernetes-client');
const { callDone, done, semaphore } = require('await-done');
const { spawn, execSync, spawnSync } = require('child_process');
const syncSpawn = require('./sync-spawn');
const JSONStream = require('json-stream');
const colors = require('colors');
const jsYaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');
const recursiveDir = require('recursive-readdir');

class kubernetesApi {
    constructor() {

    }

    async listenToK8sStatus(podName, status) {
        this.config = Api.config.fromKubeconfig();
        this.config.promises = true;
        this.core = new Api.Core(this.config);
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



    _ignoreFileFunc(file, stats) {
        // return stats.isDirectory() && path.extname(file) != "yml";
        return !stats.isDirectory() && path.extname(file) != ".yml";
    }

    async createPodsSync(yamlPath) {
        // let files = fs.readdirSync(yamlPath)
        recursiveDir(yamlPath, [this._ignoreFileFunc], async (err, files) => {
            console.log(files);
            for (var file of files) {

                //console.log(`run kubectl create -f ${file}`);
                let deploymentName = this._getDeploymentName(yamlPath, file);
                await syncSpawn(`kubectl`, `apply -f ${yamlPath} `)
                await this.listenToK8sStatus(deploymentName, `Running`)
            }
        });

    }

    _getDeploymentName(yamlPath, file) {
        try {
            let yamlPathWithFile = file;
            let yml = jsYaml.loadAll(fs.readFileSync(file, 'utf8'));
            let deploy = yml.find(y => y.kind == 'Deployment');
            if (deploy) {
                return deploy.metadata.name;
            }
            console.log(`cant find deployment for ${file} return the first kind ${yml[0].kind} `);
            return yml[0].metadata.name;
        } catch (e) {
            console.log(e);
        }
    }

}

module.exports = new kubernetesApi();