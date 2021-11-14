const jupyter = require('./jupyter');

const init = async (options) => {
    await jupyter.init(options.devenvs.jupyter);
};
module.exports = {
    init,
    jupyter
};
