const fs = require('fs');
const { resolveRefs } = require('json-refs');
const YAML = require('js-yaml');

class SwaggerLoader {
    async load({ path }) {
        const root = YAML.safeLoad(fs.readFileSync(`${path}/index.yaml`).toString());
        const swaggerOptions = {
            filter: ['relative', 'remote'],
            location: path,
            loaderOptions: {
                processContent: (res, callback) => {
                    callback(null, YAML.safeLoad(res.text));
                }
            }
        };
        const results = await resolveRefs(root, swaggerOptions);
        return results.resolved;
    }
}

module.exports = new SwaggerLoader();
