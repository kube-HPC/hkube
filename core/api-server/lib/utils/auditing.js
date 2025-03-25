module.exports = {
    generateAuditEntry(username, action, timestamp = Date.now()) {
        if (typeof username !== 'string' || !username.trim()) {
            // ('Invalid username provided for auditing.');
        }
        if (typeof action !== 'string' || !action.trim()) {
            // ('Invalid action provided for auditing.');
        }

        return {
            timestamp,
            user: username,
            action
        };
    }
};
