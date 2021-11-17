const Jupyter = require('./jupyter');

const init = async (options) => {
    await Jupyter.init(options.devenvs.jupyter);
};
module.exports = {
    init,
    Jupyter
};
