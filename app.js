var express = require('express');
var path = require('path');
var lessMiddleware = require('less-middleware');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var patch = require('./lib/patch');
var path = require('path');
var O = require('observed');
var Quassel = require('libquassel');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();
var server = require('http').Server(app);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('view options', {
	layout: false
});

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

var debug = require('debug')('quassel-webserver');

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function() {
	debug('Express server listening on port ' + server.address().port);
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
	console.log('CONNECTIOOOOOOOOON');

	var registerEvents = [], ee, quassel;
	
	var disconnected = function() {
		if (ee) {
			ee.removeAllListeners();
		}
		if (quassel) {
			quassel.removeAllListeners();
			quassel.disconnect();
		}
		quassel = null;
		ee = null;
	};
	
	socket.on('logout', disconnected);
	
	socket.on('register', function(event) {
		if (Array.isArray(event)) {
			for (var ind in event) {
				if (registerEvents.indexOf(event[ind]) === -1) {
					registerEvents.push(event[ind]);
				}
			}
		} else {
			if (registerEvents.indexOf(event) === -1) {
				registerEvents.push(event);
			}
		}
	});

	socket.on('credentials', function(data) {
		// If the client send a new connection,
		// the old one must be closed
		disconnected();
		
		quassel = new Quassel(data.server, data.port, {
			backloglimit: 20
		}, function(next) {
			next(data.user, data.password);
		});

		socket.on('sendMessage', function(bufferId, message) {
			quassel.sendMessage(bufferId, message);
		});

		quassel.on('init', function() {
			// Internal lib use, send NetworkCollection (empty) object
			var networks = quassel.getNetworks();
			socket.emit('_init', networks);
		});

		quassel.on('network.init', function(networkId) {
			var networks = quassel.getNetworks();
			var network = networks.get(networkId);
			// Internal lib use, send Network object
			socket.emit('network._init', networkId, network);
			if (typeof Object.observe !== 'undefined') {
				// Keep in sync NetworkCollection object
				ee = O(network);
				ee.on('change', function(op) {
					socket.emit.call(socket, 'change', networkId, patch(op));
				});
			}
			socket.emit('network.init', networkId);
		});

		quassel.on('**', function() {
			console.log(this.event);
			var args = Array.prototype.slice.call(arguments);
			args.unshift(this.event);
			if (this.event !== 'register' && this.event !== 'network.init' && registerEvents.indexOf(this.event) !== -1) {
				setTimeout(function() {
					socket.emit.apply(socket, args);
				}, 100);
			}
		});

		quassel.connect();
	});

	socket.on('disconnect', function() {
		console.log('DISCONNECTED');
		disconnected();
	});

	socket.emit('connected');
});

module.exports = app;
