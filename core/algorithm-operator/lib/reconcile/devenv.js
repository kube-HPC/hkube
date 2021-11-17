/* eslint-disable no-await-in-loop */
const { devenvTypes } = require('@hkube/consts');
const handlers = require('./devenvs');
const db = require('../helpers/db');

const _getRequiredState = async () => {
    const devenvs = await db.getDevenvs();
    const devenvsByType = {};
    for (const type of Object.values(devenvTypes)) {
        devenvsByType[type] = devenvs.filter(d => d.type === type);
    }
    return devenvsByType;
};

const reconcile = async () => {
    const requiredState = await _getRequiredState();
    const currentState = {};
    for (const type of Object.values(devenvTypes)) {
        currentState[type] = await handlers[type].current();
    }
    const added = {};
    for (const type of Object.values(devenvTypes)) {
        added[type] = requiredState[type].filter(a => !currentState[type].find(c => c.name === a.name));
    }
    const removed = {};
    for (const type of Object.values(devenvTypes)) {
        removed[type] = currentState[type].filter(a => !requiredState[type].find(c => c.name === a.name));
    }

    for (const type of Object.values(devenvTypes)) {
        const promises = added[type].map(a => handlers[type].create(a));
        const res = await Promise.allSettled(promises);
        await Promise.all(res.filter(r => r.status === 'fulfilled').map(s => db.updateDevenv(s.value)));
    }
    for (const type of Object.values(devenvTypes)) {
        const promises = removed[type].map(a => handlers[type].remove(a));
        await Promise.allSettled(promises);
    }
    return { added, removed };
};

module.exports = {
    reconcile,
};
