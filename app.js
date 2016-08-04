var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var lessMiddleware = require('less-middleware');
var fs = require('fs');
var opts = require('commander');
var netBrowserify = require('net-browserify-alt');

var routes = require('./routes/index');

opts
  .version('1.4.0')
  .option('-l, --listen <value>', 'listening address', undefined, null)
  .option('-p, --port <value>', 'HTTP(S) port to use', parseInt, null)
  .option('-m, --mode <value>', 'HTTP mode (http|https) [https]', undefined, 'https')
  .option('-c, --config <value>', 'path to config file', undefined, null)
  .parse(process.argv);
var settings = require('./lib/utils').settings(true, opts.config);

var app = express();
var server = null;
if (opts.mode === 'http'){
    server = require('http').Server(app);
    if (opts.port === null) opts.port = 64080;
} else {
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
    if (opts.port === null) opts.port = 64443;
}

if (opts.listen === null) opts.listen = process.env.HOST || '';

// check that prefixpath do not contains ../, and it starts with / if not empty
if (settings.prefixpath.length > 0) {
    if (settings.prefixpath.indexOf('../') > -1) {
        console.log(' ../ forbidden in prefixpath setting');
        process.exit(3);
    }
    if (settings.prefixpath[0] !== '/') {
        console.log(' prefixpath setting must begin with trailing /');
        process.exit(4);
    }
}

var nboptions = {
    server: server,
    urlRoot: settings.prefixpath + '/p'
};
if (settings.forcedefault) {
    nboptions.to = [{host: settings.default.host, port: settings.default.port}];
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('view options', {
    layout: false
});

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(settings.prefixpath, lessMiddleware(path.join(__dirname, 'public')));
app.get(settings.prefixpath+'/javascripts/libquassel.js', function(req, res) {
    res.sendFile(path.join(__dirname, 'node_modules/libquassel/client/libquassel.js'));
});
app.get(settings.prefixpath+'/javascripts/libquassel.min.js', function(req, res) {
    res.sendFile(path.join(__dirname, 'node_modules/libquassel/client/libquassel.min.js'));
});
if (settings.prefixpath.length > 0) {
    app.use(settings.prefixpath, express.static(path.join(__dirname, 'public')));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

app.use(settings.prefixpath+'/', routes);
netBrowserify(app, nboptions);

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

app.set('port', opts.port);
app.set('host', opts.listen);

server.listen(app.get('port'), app.get('host'), function() {
    console.log('Express server listening on port', server.address().port);
});

module.exports = app;
