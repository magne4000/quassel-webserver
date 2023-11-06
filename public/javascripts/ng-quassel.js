/*
 * ngSocket.js
 * https://github.com/chrisenytc/ng-socket
 *
 * Copyright (c) 2013 Christopher EnyTC, David Prothero
 * Licensed under the MIT license.
 */

// Module Copyright (c) 2013 Michael Benford

// Module for provide Socket.io support

/* global angular */
/* global libquassel */

(function () {
  'use strict';

  angular.module('ngQuassel', []).provider('$quassel', socketProvider);

  function socketProvider() {
    const WebSocketStream = libquassel.WebSocketStream;
    const Quassel = libquassel.Client;

    this.$get = ['$config', socketFactory];

    function socketFactory($config) {
      this.quassel = null;
      this.server = null;
      this.port = null;
      this.login = '';
      this.password = '';
      this.ws = null;
      const self = this;

      return {
        addListener: addListener,
        on: addListener,
        once: addListenerOnce,
        onceWithTimeout: onceWithTimeout,
        removeListener: removeListener,
        removeAllListeners: removeAllListeners,
        emit: emit,
        setServer: setServer,
        'get': getQuassel,
        markBufferAsRead: markBufferAsRead,
        moreBacklogs: moreBacklogs,
        connect: connect,
        disconnect: disconnect,
        login: login,
        supports: supports,
        Features: libquassel.Features,
        core: core
      };

      function setServer(_server, _port, _login, _password) {
        self.server = _server;
        self.port = _port;
        self.login = _login;
        self.password = _password;

        self.ws.write(JSON.stringify({
          server: _server,
          port: _port,
        }));
      }

      function getWebsocketURL() {
        const protocol = 'ws' + (window.location.protocol === 'https:' ? 's' : '');
        const hostname = window.location.hostname;
        const port = window.location.port;
        const pathname = window.location.pathname;
        return protocol +  '://' + hostname + ':' + port + pathname;
      }

      function getQuassel() {
        return self.quassel;
      }

      function initializeSocket() {
        if (self.quassel === null) {
          self.quassel = new Quassel(function(next) {
            next(self.login, self.password);
          }, {
            initialbackloglimit: $config.get('initialBacklogLimit', 20),
            backloglimit: $config.get('backlogLimit', 50),
            highlightmode: $config.get('highlightmode', 2),
            securecore: $config.get('securecore', true)
          });
        }
        if (self.ws === null) {
          self.ws = new WebSocketStream(getWebsocketURL(), ['binary', 'base64']);
        }
      }

      function angularCallback(callback) {
        return function () {
          if (callback) {
            callback.apply(self.quassel, arguments);
          }
        };
      }

      function addListener(name, scope, callback) {
        initializeSocket();

        if (arguments.length === 2) {
          scope = null;
          callback = arguments[1];
        }

        if (name.substring(0, 3) === "ws.") {
          self.ws.on(name.substring(3), callback);
        } else {
          self.quassel.on(name, angularCallback(callback));
        }

        if (scope !== null) {
          scope.$on('$destroy', function () {
            removeListener(name);
          });
        }
      }

      function addListenerOnce(name, callback) {
        initializeSocket();
        self.quassel.once(name, angularCallback(callback));
      }

      function removeListener(name, cb) {
        initializeSocket();
        if (name.substring(0, 3) === "ws.") {
          self.ws.removeListener(name.substring(3), cb);
        } else {
          self.quassel.removeListener(name, cb);
        }
      }

      function removeAllListeners(name) {
        initializeSocket();
        self.quassel.removeAllListeners(name);
      }

      function emit(name, data, callback) {
        initializeSocket();
        if (typeof callback === 'function') {
          self.quassel.emit(name, data, angularCallback(callback));
        } else {
          self.quassel.emit.apply(self.quassel, Array.prototype.slice.call(arguments));
        }
      }

      function supports(feature) {
        return self.quassel.supports(feature);
      }

      function markBufferAsRead(bufferId, lastMessageId) {
        self.quassel.core.setLastMsgRead(bufferId, lastMessageId);
        self.quassel.core.markBufferAsRead(bufferId);
        self.quassel.core.setMarkerLine(bufferId, lastMessageId);
      }

      function moreBacklogs(bufferId, firstMessageId) {
        self.quassel.core.backlog(bufferId, -1, firstMessageId, 50);
      }

      function core() {
        return self.quassel.core;
      }

      function connect() {
        initializeSocket();
        self.quassel.connect(self.ws);
      }

      function disconnect() {
        self.quassel.disconnect();
      }

      function login() {
        self.quassel.login();
      }

      function onceWithTimeout(name, timeout, callbackSuccess, callbackError) {
        let timeoutId = null;
        const callbackSuccessIntern = function() {
          clearTimeout(timeoutId);
          callbackSuccess();
        };
        timeoutId = setTimeout(function() {
          removeListener(name, callbackSuccessIntern);
          callbackError();
        }, timeout);
        addListenerOnce(name, callbackSuccessIntern);
      }
    }
  }

})();
