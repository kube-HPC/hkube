
const fs = require('fs-extra');
const request = require('request');
const { callDone, done, semaphore } = require('await-done');
const cloneAndCopy = async (path, _url, name) => {
    let _semaphore = new semaphore();
    let stream = fs.createWriteStream(`${path}${name}`)
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
    stream.on(`finish`, async () => {
        //+x 
        fs.chmodSync(`${path}${name}`, 0755);
        try {
            await fs.copy(`${path}${name}`, `/usr/local/bin/${name}`)
        } catch (error) {
            console.error(`fail to copy file ${name} to /usr/local/bin/ try use sudo `);
            _semaphore.callDone();
        }
        _semaphore.callDone();
    })
    request(`${_url}`).pipe(stream)
    await _semaphore.done();

}


module.exports = cloneAndCopy;