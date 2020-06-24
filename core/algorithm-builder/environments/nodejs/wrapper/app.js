const NodejsWrapper = require('@hkube/nodejs-wrapper');

const init = async () => {
    try {
        _handleErrors();
        NodejsWrapper.run();
    }
    catch (error) {
        _onInitFailed(error);
    }
}

const _onInitFailed = (error) => {
    console.error(error.message);
    console.error(error);
    process.exit(1);
}

const _handleErrors = () => {
    process.on('exit', (code) => {
        console.info('exit' + (code ? ' code ' + code : ''));
    });
    process.on('SIGINT', () => {
        console.info('SIGINT');
        process.exit(1);
    });
    process.on('SIGTERM', () => {
        console.info('SIGTERM');
        process.exit(1);
    });
    process.on('unhandledRejection', (error) => {
        console.error('unhandledRejection: ' + error.message);
    });
    process.on('uncaughtException', (error) => {
        console.error('uncaughtException: ' + error.message);
        process.exit(1);
    });
}

init();

