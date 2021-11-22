const jupyter = require('./jupyter');
const vscode = require('./vscode');

const init = async (options) => {
    if (!options.devenvs.enable) {
        return;
    }
    await jupyter.init(options.devenvs.jupyter);
    await vscode.init(options.devenvs.vscode);
};
module.exports = {
    init,
    jupyter,
    vscode
};
