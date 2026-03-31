const { merge } = require('webpack-merge');

const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'production',
    entry: {
        ...common.entry,
        'serviceworker': './serviceworker.js'
    },
    optimization: {
        minimize: process.env.WEBPACK_MINIMIZE !== '0'
    }
});
