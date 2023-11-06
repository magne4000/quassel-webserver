#!/usr/bin/env node

import express from 'express';
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import untildify from "untildify";
import * as pjson from './package.json' assert { type: 'json' };
import { Command } from 'commander';
import { Settings } from "./lib/utils.js";
import { WS } from "./ws.js";
import * as httpolyglot from '@httptoolkit/httpolyglot';
import http from "http";
import https from "https";
import { router } from "./routes/index.js";
import favicon from "serve-favicon";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import logger from 'morgan';
import lessMiddleware from 'less-middleware';
import { importMetaResolve } from 'resolve-esm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class QuasselWebserverApp {
    constructor() {
        this.opts = new Command();
        this.opts.version(pjson.version);
        this.opts
            .option('-c, --config <value>', 'Path to configuration file', undefined)
            .option('-s, --socket <path>', 'listen on local socket. If this option is set, --listen, --port and --mode are ignored', undefined)
            .option('-l, --listen <value>', 'listening address [0.0.0.0]', undefined)
            .option('-p, --port <value>', 'http(s) port to use [64080|64443]', parseInt)
            .option('-m, --mode <value>', 'http mode (http|https) [https]', undefined)
            .parse(process.argv);


        this.settings = new Settings();
        this.settings.init(true, this.opts.config).then(() => {
            if (this.settings.val.webserver) {
                if (this.settings.val.webserver.socket && !this.opts.socket) {
                    this.opts.socket = untildify(this.settings.val.webserver.socket);
                }
                if (this.settings.val.webserver.listen && !this.opts.listen) {
                    this.opts.listen = this.settings.val.webserver.listen;
                }
                if (this.settings.val.webserver.port && !this.opts.port) {
                    this.opts.port = this.settings.val.webserver.port;
                }
                if (this.settings.val.webserver.mode && !this.opts.mode) {
                    this.opts.mode = this.settings.val.webserver.mode;
                }
            }

            this.app = express();
            this.app.locals.settings = this.settings;
            this.run();
        })
    }

    run() {
        let server = null;
        if (this.opts.socket) {
            server = http.createServer(this.app);
            this.app.set('socket', path.normalize(this.opts.socket));
        } else {
            if (!this.opts.mode) this.opts.mode = 'https';
            if (this.opts.mode === 'http') {
                server = http.createServer(this.app);
                if (!this.opts.port) this.opts.port = 64080;
            } else if (this.opts.mode === 'https') {
                const keyPath = path.join(__dirname, 'ssl/key.pem');
                const certPath = path.join(__dirname, 'ssl/cert.pem');
                if (!fs.existsSync(keyPath)) {
                    console.log(' ! ssl/key.pem is mandatory in order to run with SSL');
                    process.exit(1);
                }
                if (!fs.existsSync(certPath)) {
                    console.log(' ! ssl/cert.pem is mandatory in order to run with SSL');
                    process.exit(2);
                }
                const options = {
                    key: fs.readFileSync(keyPath, { encoding: 'utf8' }),
                    cert: fs.readFileSync(certPath, { encoding: 'utf8' })
                };
                try {
                    server = httpolyglot.createServer(options, this.app);
                    this.app.use(function (req, res, next) {
                        if (!req.secure) {
                            return res.redirect('https://' + req.headers.host + req.url);
                        }
                        next();
                    });
                } catch (e) {
                    server = https.createServer(options, this.app);
                }
                if (!this.opts.port) this.opts.port = 64443;
            } else {
                console.log(' Invalid mode \'' + this.opts.mode + '\'');
                process.exit(5);
            }

            if (!this.opts.listen) this.opts.listen = process.env.HOST || '';
            this.app.set('port', this.opts.port);
            this.app.set('host', this.opts.listen);
            this.app.set('socket', false);
        }

        // check that prefixpath does not contain ../, and it starts with / if not empty
        if (this.settings.val.prefixpath.length > 0) {
            if (this.settings.val.prefixpath.indexOf('../') > -1) {
                console.log(' ../ forbidden in prefixpath setting');
                process.exit(3);
            }
            if (this.settings.val.prefixpath[0] !== '/') {
                console.log(' prefixpath setting must begin with trailing /');
                process.exit(4);
            }
        }

        // view engine setup
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.set('view engine', 'pug');
        this.app.set('view options', {
            layout: false
        });

        this.app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
        this.app.use(logger('dev'));
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(cookieParser());
        if (process.env.SNAP_DATA) {
            this.app.use(this.settings.val.prefixpath, lessMiddleware(path.join(__dirname, 'public'), {
                dest: path.join(process.env.SNAP_DATA)
            }));
        } else {
            this.app.use(this.settings.val.prefixpath, lessMiddleware(path.join(__dirname, 'public')));
        }
        this.app.get(this.settings.prefix('/javascripts/libquassel.js'), function (req, res) {
            res.sendFile(importMetaResolve('libquassel/dist/libquassel.js').replace('file://', '/'));
        });
        this.app.get(this.settings.prefix('/javascripts/libquassel.js.map'), function (req, res) {
            res.sendFile(importMetaResolve('libquassel/dist/libquassel.js.map').replace('file://', '/'));
        });
        if (this.settings.val.prefixpath.length > 0) {
            this.app.use(this.settings.val.prefixpath, express.static(path.join(__dirname, 'public')));
        } else {
            this.app.use(express.static(path.join(__dirname, 'public')));
        }

        this.app.use(this.settings.prefix('/'), router);

        /// catch 404 and forward to error handler
        this.app.use(function (req, res, next) {
            const err = new Error('Not Found');
            err.status = 404;
            next(err);
        });


        // development error handler
        // will print stacktrace
        if (this.app.get('env') === 'development') {
            this.app.locals.dev = true;
            this.app.use((err, req, res, next) => {
                res.status(err.status || 500)
                    .send({
                        status: err.status || 500,
                        message: err.message
                    });
            });
        } else {
            this.app.locals.dev = false;
            // production error handler
            // no stacktraces leaked to user
            this.app.use((err, req, res, next) => {
                res.status(err.status || 500)
                    .send({
                        status: err.status || 500,
                        message: err.message
                    });
            });
        }

        if (server != null) {
            WS(server, this.settings);

            if (this.app.get('socket')) {
                const socket = this.app.get('socket');

                function gracefulExit() {
                    server.close();
                }

                process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

                server.listen(socket, function () {
                    fs.chmodSync(socket, 666);
                    console.log('quassel-webserver listening on local socket', socket);
                });
            } else {
                const _opts = this.opts;
                server.listen(this.app.get('port'), this.app.get('host'), function () {
                    console.log('quassel-webserver listening for', _opts.mode, 'connections on port', server.address().port);
                });
            }
        } else {
            console.log('server instance could not be determined');
            process.exit(5);
        }
    }
}

new QuasselWebserverApp();
