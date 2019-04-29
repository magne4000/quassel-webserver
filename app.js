var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var lessMiddleware = require('less-middleware');
var fs = require('fs');
var untildify = require('untildify');
var pjson = require('./package.json');
var opts = require('commander');
var utils = require('./lib/utils');
var ws = require('./ws');

opts
  .version(pjson.version)
  .option('-c, --config <value>', 'Path to configuration file', undefined)
  .option('-s, --socket <path>', 'listen on local socket. If this option is set, --listen, --port and --mode are ignored', undefined)
  .option('-l, --listen <value>', 'listening address [0.0.0.0]', undefined)
  .option('-p, --port <value>', 'http(s) port to use [64080|64443]', parseInt)
  .option('-m, --mode <value>', 'http mode (http|https) [https]', undefined)
  .parse(process.argv);

var settings = new utils.settings(true, opts.config);
var routes = require('./routes/index');

if (settings.val.webserver) {
    if (settings.val.webserver.socket && !opts.socket) {
        opts.socket = untildify(settings.val.webserver.socket);
    }
    if (settings.val.webserver.listen && !opts.listen) {
        opts.listen = settings.val.webserver.listen;
    }
    if (settings.val.webserver.port && !opts.port) {
        opts.port = settings.val.webserver.port;
    }
    if (settings.val.webserver.mode && !opts.mode) {
        opts.mode = settings.val.webserver.mode;
    }
}

var app = express();
app.locals.settings = settings;

var server = null;
if (opts.socket) {
    server = require('http').createServer(app);
    app.set('socket', path.normalize(opts.socket));
} else {
    if (!opts.mode) opts.mode = 'https';
    if (opts.mode === 'http') {
        server = require('http').createServer(app);
        if (!opts.port) opts.port = 64080;
    } else if (opts.mode === 'https') {
        var keypath = path.join(__dirname, 'ssl/key.pem');
        var certpath = path.join(__dirname, 'ssl/cert.pem');
        if (!fs.existsSync(keypath)) {
            console.log(' ! ssl/key.pem is mandatory in order to run with SSL');
            process.exit(1);
        }
        if (!fs.existsSync(certpath)) {
            console.log(' ! ssl/cert.pem is mandatory in order to run with SSL');
            process.exit(2);
        }
        var options = {
            key: fs.readFileSync(keypath, {encoding: 'utf8'}),
            cert: fs.readFileSync(certpath, {encoding: 'utf8'})
        };
        try {
            server = require('httpolyglot').createServer(options, app);
            app.use(function(req, res, next) {
                if (!req.secure) {
                    return res.redirect('https://' + req.headers.host + req.url);
                }
                next();
            });
        } catch(e) {
            server = require('https').createServer(options, app);
        }
        if (!opts.port) opts.port = 64443;
    } else {
        console.log(' Invalid mode \'' + opts.mode + '\'');
        process.exit(5);
    }
    
    if (!opts.listen) opts.listen = process.env.HOST || '';
    app.set('port', opts.port);
    app.set('host', opts.listen);
    app.set('socket', false);
}

// check that prefixpath do not contains ../, and it starts with / if not empty
if (settings.val.prefixpath.length > 0) {
    if (settings.val.prefixpath.indexOf('../') > -1) {
        console.log(' ../ forbidden in prefixpath setting');
        process.exit(3);
    }
    if (settings.val.prefixpath[0] !== '/') {
        console.log(' prefixpath setting must begin with trailing /');
        process.exit(4);
    }
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('view options', {
    layout: false
});

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
if (process.env.SNAP_DATA) {
    app.use(settings.val.prefixpath, lessMiddleware(path.join(__dirname, 'public'), {
        dest: path.join(process.env.SNAP_DATA)
    }));
} else {
    app.use(settings.val.prefixpath, lessMiddleware(path.join(__dirname, 'public')));
}
app.get(settings.prefix('/javascripts/libquassel.js'), function(req, res) {
    res.sendFile(require.resolve('libquassel/dist/libquassel.js'));
});
app.get(settings.prefix('/javascripts/libquassel.js.map'), function(req, res) {
    res.sendFile(require.resolve('libquassel/dist/libquassel.js.map'));
});
if (settings.val.prefixpath.length > 0) {
    app.use(settings.val.prefixpath, express.static(path.join(__dirname, 'public')));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

app.use(settings.prefix('/'), routes);

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
    app.locals.dev = true;
    app.use(function(err, req, res) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
} else {
    app.locals.dev = false;
    // production error handler
    // no stacktraces leaked to user
    app.use(function(err, req, res) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });
}

ws(server, settings);

if (app.get('socket')) {
    var socket = app.get('socket');
    function gracefulExit() {
        server.close();
    }
    process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

    server.listen(socket, function() {
        fs.chmodSync(socket, 0666);
        console.log('quassel-webserver listening on local socket', socket);
    });
} else {
    server.listen(app.get('port'), app.get('host'), function() {
        console.log('quassel-webserver listening for', opts.mode, 'connections on port', server.address().port);
    });
}

module.exports = app;
