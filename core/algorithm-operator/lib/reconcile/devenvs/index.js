const Jupyter = require('./jupyter');

const init = async (options) => {
    if (!options.devenvs.enable) {
        return;
    }
    await Jupyter.init(options.devenvs.jupyter);
};
module.exports = {
    init,
    Jupyter
};
