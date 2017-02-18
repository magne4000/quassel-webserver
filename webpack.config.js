/* jshint esversion:6, asi: true */
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const webpack = require('webpack')

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
	target: 'electron-renderer',
	plugins: [
		new ExtractTextPlugin('[name].css'),
		new webpack.ProvidePlugin({
		  jQuery: 'jquery',
		  $: 'jquery',
		  jquery: 'jquery',
		  "window.jQuery": 'jquery'
		}),
		new webpack.optimize.CommonsChunkPlugin({
			names: ['vendor', 'manifest']
		})
	],
	devtool: "cheap-source-map"
}
module.exports = config
