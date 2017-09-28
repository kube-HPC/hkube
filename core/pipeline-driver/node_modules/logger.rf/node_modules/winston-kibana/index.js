var _ = require('lodash');
var os = require('os');

/**
 * Expose module.
 */

module.exports = function kibanaRewriterFactory(options) {
  return function kibanaRewriter(level, message, metadata) {
    // Keep original metadata safe.
    metadata = _.clone(metadata || {});

    // Extend metadata with some default.
    metadata.level = level;
    metadata.hostname = os.hostname();
    metadata.env = process.env.NODE_ENV;
    metadata.category = metadata.category || 'no-category';
    metadata['@timestamp'] = new Date().toJSON();

    // Extend with options.
    _.extend(metadata, options);

    return metadata;
  };
};