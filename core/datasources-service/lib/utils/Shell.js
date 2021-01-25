const log = require('@hkube/logger').GetLogFromContainer();
const childProcess = require('child_process');

const Shell = cwd => async (command, args) => {
    // console.info({ command, args, cwd });
    const cmd = childProcess.spawn(command, args, { cwd });
    log.debug(
        `running shell command: ${command} with args: ${args} on dir: ${cwd}`
    );
    return new Promise((res, rej) => {
        let cache = '';
        cmd.stdout.on('data', d => {
            cache += d.toString();
        });
        cmd.stderr.on('data', d => {
            cache += d.toString();
        });
        cmd.stdout.on('error', () => rej(cache));
        cmd.on('error', rej);
        cmd.on('close', errorCode =>
            errorCode !== 0 ? rej(cache) : res(cache)
        );
    });
};

const pidExists = pid => {
    let pidOk = true;
    try {
        process.kill(pid, 0);
    } catch (e) {
        pidOk = false;
    }
    return pidOk;
};

const ShellFast = cwd => async (command, args) => {
    // console.info({ command, args, cwd });
    const cmd = childProcess.spawn(command, args, { cwd });
    log.debug(
        `running shell command: ${command} with args: ${args} on dir: ${cwd}`
    );
    return new Promise((res, rej) => {
        let cache = '';
        const interval = setInterval(() => {
            if (pidExists(cmd.pid)) {
                // console.log('file is still open', new Date().getTime());
            } else {
                clearInterval(interval);
                res(cache);
            }
        }, 50);
        cmd.stdout.on('data', d => {
            cache += d.toString();
        });
        cmd.stderr.on('data', d => {
            cache += d.toString();
        });
        cmd.stdout.on('error', () => rej(cache));
        cmd.on('error', rej);
        // cmd.on('close', errorCode =>
        //     errorCode !== 0 ? rej(cache) : res(cache)
        // );
    });
};
module.exports = { Shell, ShellFast };
