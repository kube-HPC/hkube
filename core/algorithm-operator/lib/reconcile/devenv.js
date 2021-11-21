/* eslint-disable no-await-in-loop */
const { devenvTypes, devenvStatuses } = require('@hkube/consts');
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
        added[type] = requiredState[type].filter(a => a.status === devenvStatuses.PENDING && !currentState[type].find(c => c.name === a.name));
    }
    const removed = {};
    for (const type of Object.values(devenvTypes)) {
        const markedForRemoval = requiredState[type].filter(c => c.status === devenvStatuses.DELETING);
        removed[type] = currentState[type].filter(a => !requiredState[type].find(c => c.name === a.name));
        removed[type] = removed[type].concat(markedForRemoval);
    }

    const stopped = {};
    for (const type of Object.values(devenvTypes)) {
        stopped[type] = requiredState[type].filter(a => a.status === devenvStatuses.STOPPED && currentState[type].find(c => c.name === a.name));
    }

    for (const type of Object.values(devenvTypes)) {
        const promises = added[type].map(a => handlers[type].create(a));
        const res = await Promise.allSettled(promises);
        await Promise.all(res.filter(r => r.status === 'fulfilled').map(s => db.updateDevenv(s.value)));
    }
    for (const type of Object.values(devenvTypes)) {
        const promises = removed[type].map(a => handlers[type].delete(a));
        const deletedPromises = removed[type].map(a => db.deleteDevenv(a.name));
        await Promise.allSettled([...promises, ...deletedPromises]);
    }
    for (const type of Object.values(devenvTypes)) {
        const promises = stopped[type].map(a => handlers[type].stop(a));
        await Promise.allSettled(promises);
    }
    return { added, removed, stopped };
};

module.exports = {
    reconcile,
};
