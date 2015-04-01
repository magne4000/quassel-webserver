var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var lessMiddleware = require('less-middleware');
//var jsonpatch = require('fast-json-patch');
var patch = require('./lib/patch');
var fs = require('fs');
var O = require('observed');
var debug = require('debug');
var Quassel = require('libquassel');

var routes = require('./routes/index');

var settings = require('./lib/utils').settings(true);

var opts = require("nomnom")
    .option('port', {
        abbr: 'p',
        default: null,
        help: 'HTTP port to use'
    })
    .option('mode', {
        abbr: 'm',
        default: 'https',
        choices: ['http', 'https'],
        help: 'Use HTTP or HTTPS'
    })
    .option('unsecurecore', {
        abbr: 'u',
        flag: true,
        help: 'Connect to the core without using SSL'
    })
    .parse();

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
    server = require('https').createServer(options, app);
    if (opts.port === null) opts.port = 64443;
}

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
if (settings.prefixpath.length > 0) {
    app.use(settings.prefixpath, express.static(path.join(__dirname, 'public')));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

app.use(settings.prefixpath+'/', routes);

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

var loggerqw = debug('quassel-webserver');

app.set('port', opts.port);
app.set('host', process.env.HOST || '');

server.listen(app.get('port'), app.get('host'), function() {
    loggerqw('Express server listening on port ' + server.address().port);
});

var io = require('socket.io')(server, {path: settings.prefixpath + '/socket.io'});

io.on('connection', function(socket) {
    var registerEvents = ['login', 'loginfailed'], ee, quassel, isConnected = false, socketListeners = [];
    
    function addListener(sckt, evt, cb) {
        sckt.on(evt, cb);
        socketListeners.push(evt);
    }
    
    function removeAllListeners(sckt) {
        for (var i=0; i<socketListeners.length; i++) {
            sckt.removeAllListeners(socketListeners[i]);
        }
        socketListeners = [];
    }
    
    var disconnected = function() {
        if (ee) {
            ee.removeAllListeners();
        }
        if (quassel) {
            quassel.removeAllListeners();
            quassel.disconnect();
        }
        removeAllListeners(socket);
        quassel = null;
        ee = null;
        isConnected = false;
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
        if (isConnected) return;
        // If the client send a new connection,
        // the old one must be closed
        disconnected();
        isConnected = true;

        if (settings.forcedefault) {
            data.server = settings.default.host;
            data.port = settings.default.port;
        }
        
        quassel = new Quassel(data.server, data.port, {
            nobacklogs: settings.default.initialBacklogLimit === 0,
            backloglimit: settings.default.initialBacklogLimit || 50,
            unsecurecore: opts.unsecurecore
        }, function(next) {
            next(data.user, data.password);
        });
        
        addListener(socket, 'sendMessage', function(bufferId, message) {
            quassel.sendMessage(bufferId, message);
        });
        
        addListener(socket, 'moreBacklogs', function(bufferId, firstMessageId) {
            quassel.requestBacklog(bufferId, -1, firstMessageId, settings.default.backlogLimit || 50);
        });
        
        addListener(socket, 'requestDisconnectNetwork', function(networkId) {
            quassel.requestDisconnectNetwork(networkId);
        });
        
        addListener(socket, 'requestConnectNetwork', function(networkId) {
            quassel.requestConnectNetwork(networkId);
        });
        
        addListener(socket, 'requestRemoveBuffer', function(bufferId) {
            quassel.requestRemoveBuffer(bufferId);
        });
        
        addListener(socket, 'requestMergeBuffersPermanently', function(bufferId1, bufferId2) {
            quassel.requestMergeBuffersPermanently(bufferId1, bufferId2);
        });
        
        addListener(socket, 'markBufferAsRead', function(bufferId, lastMessageId) {
            quassel.requestSetLastMsgRead(bufferId, lastMessageId);
            quassel.requestMarkBufferAsRead(bufferId);
            quassel.requestSetMarkerLine(bufferId, lastMessageId);
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
            // Keep in sync NetworkCollection object
            ee = O(network);
            ee.on('change', function(op) {
                socket.emit.call(socket, 'change', networkId, patch(op));
            });
            /*
            jsonpatch.observe(network, function(op) {
                socket.emit.call(socket, 'change', networkId, op);
            });*/
            socket.emit('network.init', networkId);
        });
        
        quassel.on('loginfailed', function() {
            disconnected();
        });
        
        quassel.on('**', function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(this.event);
            if (this.event !== 'register' && this.event !== 'network.init' && registerEvents.indexOf(this.event) !== -1) {
                setTimeout(function() {
                    socket.emit.apply(socket, args);
                }, 10);
            }
        });

        quassel.connect();
    });

    socket.on('disconnect', function() {
        disconnected();
    });

    socket.emit('connected');
});

module.exports = app;
