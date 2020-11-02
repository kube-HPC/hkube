const { db } = require('../db');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    /** @param {{ name: string; file: Express.Multer.File}} props */
    validateCreate(props) {
        this._validator.validate(this._validator.definitions.dataSourceCreate, { ...props, file: props.file?.originalname });
    }

    /** @param {{ file: Express.Multer.File; }} props */
    validateUploadFile(props) {
        this._validator.validate(this._validator.definitions.dataSourceUploadFile, { ...props, file: props.file?.originalname });
    }

    /**
     * we can check all dataSources exists in mongoDB by:
     * 1. multiple requests - Promise.all     - (N requests) - not good
     * 2. serial requests   - async generator - (1...N requests) - nice.
     * 3. single request    - bulk operation  - (1 request) - very good.
     */
    async validateDataSourceExists(metadata) {
        // temp solution, the parser will also return list of dataSources.
        const rgx = /(^\w+)(\.)(\w+)(\/)(\w+)/; //
        const map = Object.keys(metadata).map(m => m.match(rgx)[3]);
        const dataSources = [...new Set(map)];

        for await (let ds of this._dataSourceFetcher(dataSources)) {
            console.log(ds);
        }
    }

    async* _dataSourceFetcher(dataSources) {
        for (const name of dataSources) {
            const dataSource = await db.dataSources.fetch({ name });
            yield dataSource;
        }
    }
}

module.exports = ApiValidator;
