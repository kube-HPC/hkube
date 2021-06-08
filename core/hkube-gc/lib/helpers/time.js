const moment = require('moment');

const shouldDelete = (timestamp, minutes) => {
    return moment(timestamp).isBefore(moment().subtract(minutes, 'minutes'));
};

const formatDate = (date) => {
    return moment(date).format('DD/MM/YYYY HH:mm:ss');
};

module.exports = {
    shouldDelete,
    formatDate
};
