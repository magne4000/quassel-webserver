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
    var Quassel = libquassel.Client;
    
    this.$get = ['$config', socketFactory];

    function socketFactory($config) {
      this.quassel = null;
      this.server = null;
      this.port = null;
      this.login = '';
      this.password = '';
      this.ws = null;
      this._ws_cb = [];
      var self = this;
      
      var service = {
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

      return service;
      
      function setServer(_server, _port, _login, _password) {
        self.server = _server;
        self.port = _port;
        self.login = _login;
        self.password = _password;
        
        self.ws.socket.send(JSON.stringify({
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
            triggerWebsocketBindings();
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
            var args = arguments;
            callback.apply(self.quassel, args);
          }
        };
      }

      function addListener(name, scope, callback) {
        initializeSocket();

        if (arguments.length === 2) {
          scope = null;
          callback = arguments[1];
        }
        
        if (name.substr(0, 3) == "ws.") {
          self._ws_cb.push({name: name.substr(3), callback: callback, active: false});
          triggerWebsocketBindings();
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
        if (name.substr(0, 3) == "ws.") {
          self.ws.removeEventListener(name.substr(3), cb);
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
        self.quassel.requestSetLastMsgRead(bufferId, lastMessageId);
        self.quassel.requestMarkBufferAsRead(bufferId);
        self.quassel.requestSetMarkerLine(bufferId, lastMessageId);
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
      
      function triggerWebsocketBindings() {
        if (self.ws !== null) {
          var i = 0;
          for (; i<self._ws_cb.length; i++) {
            if (self._ws_cb[i].active === false) {
              self.ws['on'+self._ws_cb[i].name] = self._ws_cb[i].callback;
              self._ws_cb[i].active = true;
            }
          }
        }
      }
      
      function onceWithTimeout(name, timeout, callbackSuccess, callbackError) {
        var timeoutId = null;
        var callbackSuccessIntern = function() {
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
