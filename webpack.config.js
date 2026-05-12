const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (_env, argv) => {
    const isDev = argv.mode !== 'production';
    return {
        entry: path.join(__dirname, 'src/index.js'),
        output: {
            path: path.join(__dirname, 'dist/'),
            filename: 'index.js',
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.js/,
                    exclude: /node_modules/,
                },
                {
                    test: /\.css/,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.json$/,
                    type: 'json',
                },
            ],
        },
        performance: { hints: false },
        stats: 'minimal',
        devtool: isDev ? 'source-map' : false,
        // Single-file bundle. SillyTavern loads only one JS per manifest `js` entry.
        optimization: {
            minimize: !isDev,
            usedExports: true,
            splitChunks: false,
            runtimeChunk: false,
            minimizer: [new TerserPlugin({ extractComments: false })],
        },
    };
};
