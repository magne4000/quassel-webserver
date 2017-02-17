/* jshint esversion:6, asi: true */
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')
const merge = require('webpack-merge')

const config = {
	entry: {
		main: './src/entry.js',
		vendor: ("jquery angular angular-aria angular-ui-bootstrap bootstrap-tokenfield angularjs-scroll-glue " +
		         "favico.js angular-sanitize @cgross/angular-notify @iamadamjowett/angular-click-outside").split(' '),
		"theme-darksolarized": './public/stylesheets/theme-darksolarized.less',
		"theme-default": './public/stylesheets/theme-default.less'
	},
	output: {
		filename: '[name].js',
		path: __dirname + '/dist',
		//publicPath: '../dist/'
	},
	module: {
		rules: [{
			test: /\.css$/,
			use: ExtractTextPlugin.extract({use: 'css-loader'})
		}, {
			test: /\.less$/,
			use: ExtractTextPlugin.extract({
				fallback: "style-loader",
				use: "css-loader!less-loader"
			})
		}, {
			test: /\.(jpe?g|png|gif)$/i,
			loader: 'file-loader?name=img/[name].[ext]'
		}, {
			test: /\.(eot|svg|ttf|woff2?)$/i,
			loader: 'file-loader?name=font/[name].[ext]'
		}
	]},
	plugins: [
		new ExtractTextPlugin('[name].css'),
		new webpack.ProvidePlugin({
		  "window.jQuery": 'jquery',
		}),
		new webpack.optimize.CommonsChunkPlugin({
			names: ['vendor', 'manifest']
		}),
		new CopyWebpackPlugin([
			{from: 'public/favicon.ico'}
		])
	],
	devtool: "cheap-source-map"
}
const platform_specific = {
	'electron-renderer': {
		target: 'electron-renderer',
	},
	web: {
		target: 'web',
		plugins: [
			new webpack.ProvidePlugin({
				Buffer: __dirname + "/src/buffershim.js"
			})
		],
		node: {
			zlib: true,
			tty: true,
			stream: true,
			buffer: false,
			Buffer: false
		},
		resolve: {
			alias: {
				tls$: __dirname + "/node_modules/tls-browserify",
				net$: __dirname + "/node_modules/net-browserify-alt",
				buffer$: __dirname + "/node_modules/buffer"
			}
		},
	}
}
module.exports = (env) =>
	merge(config, platform_specific[(env ? env.platform : null) || 'web'])
