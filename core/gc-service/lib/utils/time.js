const moment = require('moment');

const isTimeBefore = (timestamp, minutes) => {
    return moment(timestamp).isBefore(moment().subtract(minutes, 'minutes'));
};

const formatDate = (date) => {
    if (!date) {
        return null;
    }
    return moment(date).format('DD/MM/YYYY HH:mm:ss');
};

module.exports = {
    isTimeBefore,
    formatDate
};
