const { InvalidDataError } = require('../errors');

const ALLOWED_FIELDS = ['theme', 'scoopIntervalHours', 'tables'];
const ALLOWED_THEMES = ['light', 'dark', 'lightsOut'];
const ALLOWED_SCOOP_INTERVALS = [1, 24, 168, 720];
const ALLOWED_TABLE_KEYS = ['jobs', 'algorithms', 'pipelines'];
const ALLOWED_COLUMN_PROPS = ['visible', 'width'];

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validatePreferences(preferences) {
        if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
            throw new InvalidDataError('preferences must be a valid object');
        }

        const unknownFields = Object.keys(preferences).filter(k => !ALLOWED_FIELDS.includes(k));
        if (unknownFields.length > 0) {
            throw new InvalidDataError(`unknown preferences fields: ${unknownFields.join(', ')}`);
        }

        if (preferences.theme !== undefined) {
            if (!ALLOWED_THEMES.includes(preferences.theme)) {
                throw new InvalidDataError(`preferences.theme must be one of: ${ALLOWED_THEMES.join(', ')}`);
            }
        }

        if (preferences.scoopIntervalHours !== undefined) {
            if (!ALLOWED_SCOOP_INTERVALS.includes(preferences.scoopIntervalHours)) {
                throw new InvalidDataError(`preferences.scoopIntervalHours must be one of: ${ALLOWED_SCOOP_INTERVALS.join(', ')}`);
            }
        }

        if (preferences.tables !== undefined) {
            this._validateTables(preferences.tables);
        }
    }

    _validateTables(tables) {
        if (typeof tables !== 'object' || Array.isArray(tables) || tables === null) {
            throw new InvalidDataError('preferences.tables must be an object');
        }
        const unknownTables = Object.keys(tables).filter(k => !ALLOWED_TABLE_KEYS.includes(k));
        if (unknownTables.length > 0) {
            throw new InvalidDataError(`unknown tables keys: ${unknownTables.join(', ')}. Allowed: ${ALLOWED_TABLE_KEYS.join(', ')}`);
        }
        Object.entries(tables).forEach(([tableName, tableValue]) => {
            if (typeof tableValue !== 'object' || Array.isArray(tableValue) || tableValue === null) {
                throw new InvalidDataError(`preferences.tables.${tableName} must be an object`);
            }
            const tableKeys = Object.keys(tableValue);
            if (tableKeys.length > 1 || (tableKeys.length === 1 && tableKeys[0] !== 'columns')) {
                throw new InvalidDataError(`preferences.tables.${tableName} may only contain "columns"`);
            }
            if (tableValue.columns !== undefined) {
                this._validateColumns(tableName, tableValue.columns);
            }
        });
    }

    _validateColumns(tableName, columns) {
        if (typeof columns !== 'object' || Array.isArray(columns) || columns === null) {
            throw new InvalidDataError(`preferences.tables.${tableName}.columns must be an object`);
        }
        Object.entries(columns).forEach(([colName, colSettings]) => {
            if (typeof colSettings !== 'object' || Array.isArray(colSettings) || colSettings === null) {
                throw new InvalidDataError(`preferences.tables.${tableName}.columns.${colName} must be an object`);
            }
            const unknownProps = Object.keys(colSettings).filter(k => !ALLOWED_COLUMN_PROPS.includes(k));
            if (unknownProps.length > 0) {
                throw new InvalidDataError(`unknown column properties in ${tableName}.${colName}: ${unknownProps.join(', ')}`);
            }
            if (colSettings.visible !== undefined && typeof colSettings.visible !== 'boolean') {
                throw new InvalidDataError(`preferences.tables.${tableName}.columns.${colName}.visible must be a boolean`);
            }
            if (colSettings.width !== undefined) {
                if (!Number.isInteger(colSettings.width) || colSettings.width < 1) {
                    throw new InvalidDataError(`preferences.tables.${tableName}.columns.${colName}.width must be a positive integer`);
                }
            }
        });
    }
}

module.exports = ApiValidator;
