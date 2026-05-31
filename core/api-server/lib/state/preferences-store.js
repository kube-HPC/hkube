const Logger = require('@hkube/logger');
const component = require('../consts/componentNames').DB;
let log;

const COLLECTION_NAME = 'userPreferences';

class PreferencesStore {
    async init(db) {
        log = Logger.GetLogFromContainer();
        this._collection = db.collection(COLLECTION_NAME);
        await this._collection.createIndex(
            { userId: 1 },
            { name: 'userId', unique: true }
        );
        log.info(`initialized ${COLLECTION_NAME} collection`, { component });
    }

    async get(userId) {
        const doc = await this._collection.findOne({ userId });
        if (!doc) {
            return {};
        }
        const { _id, userId: _uid, updatedAt, ...preferences } = doc;
        return preferences;
    }

    async set(userId, preferences) {
        const { _id, userId: _uid, updatedAt, ...cleanPrefs } = preferences;
        const result = await this._collection.findOneAndReplace(
            { userId },
            { ...cleanPrefs, userId, updatedAt: new Date() },
            { upsert: true, returnOriginal: false }
        );
        const saved = result.value;
        const { _id: _docId, userId: _savedUid, updatedAt: _ts, ...savedPrefs } = saved;
        return savedPrefs;
    }

    async remove(userId) {
        await this._collection.deleteOne({ userId });
        return {};
    }
}

module.exports = new PreferencesStore();
