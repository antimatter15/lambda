const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');

module.exports = {
    entry: {
        main: path.resolve(__dirname, 'src', 'main.js'),
        vendor: ['react', 'katex', 'split.js', 'codemirror', 'jquery', 'jquery-ui', 'd3']
    },
    output: {
        path: path.resolve(__dirname, 'web', 'build'),
        filename: '[name].js'
    },
    module: {
        loaders: [
            {test: /\.js$/, include: /src/, exclude: /node_modules/, loader: 'babel', query: {presets: ['react', 'es2015', 'stage-0']}},
            {test: /\.css$/, loader: ExtractTextPlugin.extract('style', 'css!postcss')},
            {test: /\.(png|woff|woff2|eot|ttf|svg)$/, loader: 'url'},
            {test: /\.json$/, loader: 'json'}
        ]
    },
    node: {
        fs: "empty",
        net: "empty",
        tls: "empty"
    },
    plugins: [
        new ExtractTextPlugin('styles.css'),
        new CommonsChunkPlugin({
            name: 'vendor',
            minChunks: Infinity
        })
    ]
};