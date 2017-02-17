// this file exists in order to shim Buffer (the default webpack one is too old)
// it gets ProvidePlugin'd at webpack.config.js.
module.exports = require("buffer").Buffer;
