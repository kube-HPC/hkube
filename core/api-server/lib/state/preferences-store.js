const Logger = require('@hkube/logger');
const component = require('../consts/componentNames').DB;
let log;

const COLLECTION_NAME = 'userPreferences';

class PreferencesStore {
    async init(db) {
        log = Logger.GetLogFromContainer();
        this._collection = db.collection(COLLECTION_NAME);
        await this._migrateUserIdToUserName();
        await this._collection.createIndex(
            { userName: 1 },
            { name: 'userName', unique: true }
        );
        log.info(`initialized ${COLLECTION_NAME} collection`, { component });
    }

    // One-time migration: rename legacy `userId` field/index to `userName`.
    async _migrateUserIdToUserName() {
        const indexes = await this._collection.indexes();
        if (indexes.some(index => index.name === 'userId')) {
            await this._collection.dropIndex('userId');
        }
        await this._collection.updateMany(
            { userId: { $exists: true }, userName: { $exists: false } },
            [{ $set: { userName: '$userId' } }, { $unset: 'userId' }]
        );
        log.info(`migrated legacy userId field/index in ${COLLECTION_NAME} collection`, { component });
    }

    async get(userName) {
        const doc = await this._collection.findOne({ userName });
        if (!doc) {
            return {};
        }
        const { _id, userName: _uname, updatedAt, ...preferences } = doc;
        return preferences;
    }

    async set(userName, preferences) {
        const { _id, userName: _uname, updatedAt, ...cleanPrefs } = preferences;
        const result = await this._collection.findOneAndReplace(
            { userName },
            { ...cleanPrefs, userName, updatedAt: new Date() },
            { upsert: true, returnOriginal: false }
        );
        const saved = result.value;
        const { _id: _docId, userName: _savedUname, updatedAt: _ts, ...savedPrefs } = saved;
        return savedPrefs;
    }

    async remove(userName) {
        await this._collection.deleteOne({ userName });
        return {};
    }
}

module.exports = new PreferencesStore();
