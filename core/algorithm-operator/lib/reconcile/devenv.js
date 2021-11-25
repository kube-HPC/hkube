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

const _isPendingState = (state) => {
    return state === devenvStatuses.PENDING || state === devenvStatuses.CREATING;
};

const reconcile = async (createOptions = {}) => {
    const requiredState = await _getRequiredState();
    const currentState = {};
    const added = {};
    const removed = {};
    const stopped = {};
    const updateStatus = {};
    for (const type of Object.values(devenvTypes)) {
        currentState[type] = await handlers[type].current();

        added[type] = requiredState[type].filter(a => a.status === devenvStatuses.PENDING && !currentState[type].find(c => c.name === a.name));

        const markedForRemoval = requiredState[type].filter(c => c.status === devenvStatuses.DELETING);
        removed[type] = currentState[type].filter(a => !requiredState[type].find(c => c.name === a.name));
        removed[type] = removed[type].concat(markedForRemoval);

        stopped[type] = requiredState[type].filter(a => a.status === devenvStatuses.STOPPED && currentState[type].find(c => c.name === a.name));

        updateStatus[type] = currentState[type].filter(c => c.status === devenvStatuses.RUNNING
            && _isPendingState(requiredState[type].find(r => r.name === c.name)?.status));

        const updateStopped = requiredState[type].filter(a => a.status === devenvStatuses.RUNNING && !currentState[type].find(c => c.name === a.name));
        updateStopped.forEach((a) => {
            updateStatus[type].push({ ...a, status: devenvStatuses.STOPPED });
        });
    }

    for (const type of Object.values(devenvTypes)) {
        let promises = added[type].map(a => handlers[type].create(a, createOptions));
        const res = await Promise.allSettled(promises);
        await Promise.all(res.filter(r => r.status === 'fulfilled').map(s => db.updateDevenv(s.value)));

        promises = removed[type].map(a => handlers[type].delete(a));
        const deletedPromises = removed[type].map(a => db.deleteDevenv({ name: a.name }));
        await Promise.allSettled([...promises, ...deletedPromises]);

        promises = updateStatus[type].map(a => db.updateDevenv({ name: a.name, status: a.status }));
        await Promise.allSettled(promises);

        promises = stopped[type].map(a => handlers[type].stop(a));
        await Promise.allSettled(promises);
    }
    return { added, removed, stopped, updateStatus };
};

module.exports = {
    reconcile,
};
