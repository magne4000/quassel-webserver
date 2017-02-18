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

(function () {
  'use strict';

  angular.module('ngQuassel', []).provider('$quassel', socketProvider);

  function socketProvider() {
    var Quassel = require("libquassel");
    
    this.$get = ['$config', socketFactory];

    function socketFactory($config) {
      this.quassel = null;
      this.server = '';
      this.port = '';
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
        sendMessage: sendMessage,
        requestDisconnectNetwork: requestDisconnectNetwork,
        requestConnectNetwork: requestConnectNetwork,
        requestRemoveBuffer: requestRemoveBuffer,
        requestMergeBuffersPermanently: requestMergeBuffersPermanently,
        requestUpdateIdentity: requestUpdateIdentity,
        requestUpdateIgnoreListManager: requestUpdateIgnoreListManager,
        requestSetNetworkInfo: requestSetNetworkInfo,
        createNetwork: createNetwork,
        removeNetwork: removeNetwork,
        createIdentity: createIdentity,
        removeIdentity: removeIdentity,
        connect: connect,
        disconnect: disconnect,
        login: login,
        requestUnhideBuffer: requestUnhideBuffer,
        requestHideBufferPermanently: requestHideBufferPermanently,
        requestHideBufferTemporarily: requestHideBufferTemporarily,
        requestRenameBuffer: requestRenameBuffer,
        requestUpdateAliasManager: requestUpdateAliasManager,
        requestCreateBufferView: requestCreateBufferView,
        supports: supports,
        Feature: Quassel.Feature
      };

      return service;
      
      function setServer(_server, _port, _login, _password) {
        self.server = _server;
        self.port = _port;
        self.login = _login;
        self.password = _password;
        self.quassel.server = self.server;
        self.quassel.port = self.port;
      }
      
      function getQuassel() {
        return self.quassel;
      }

      function initializeSocket() {
        //Check if socket is undefined
        if (self.quassel === null) {
          var net = require('net');
          var has_ws_proxy = !!net.setProxy;
          if (has_ws_proxy) {
            net.setProxy({
                path: window.location.pathname + 'p',
            });
          }
          self.quassel = new Quassel(self.server, self.port, {
              nobacklogs: $config.get('initialBacklogLimit', 0) === 0,
              initialbackloglimit: $config.get('initialBacklogLimit', 20),
              backloglimit: $config.get('backlogLimit', 50),
              highlightmode: $config.get('highlightmode', 2),
              securecore: $config.get('securecore', true)  // tls-browserify module doesn't respect tls API of nodejs
          }, function(next) {
              next(self.login, self.password);
              var istls = self.quassel.useSSL;
              if (istls) {
                self.ws = self.quassel.qtsocket.socket._socket;
              } else {
                self.ws = self.quassel.qtsocket.socket;
              }
              if (has_ws_proxy) self.ws = self.ws._ws;
              triggerWebsocketBindings();
          });
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
        self.quassel.requestBacklog(bufferId, -1, firstMessageId, 50);
      }
      
      function sendMessage(bufferId, message) {
        self.quassel.sendMessage(bufferId, message);
      }
      
      function requestDisconnectNetwork(networkId) {
        self.quassel.requestDisconnectNetwork(networkId);
      }
      
      function requestConnectNetwork(networkId) {
        self.quassel.requestConnectNetwork(networkId);
      }
      
      function requestRemoveBuffer(bufferId) {
        self.quassel.requestRemoveBuffer(bufferId);
      }
      
      function requestMergeBuffersPermanently(bufferId1, bufferId2) {
        self.quassel.requestMergeBuffersPermanently(bufferId1, bufferId2);
      }
      
      function requestUnhideBuffer(bufferViewId, bufferId) {
        self.quassel.requestUnhideBuffer(bufferViewId, bufferId);
      }
      
      function requestHideBufferTemporarily(bufferViewId, bufferId) {
        self.quassel.requestHideBufferTemporarily(bufferViewId, bufferId);
      }
      
      function requestHideBufferPermanently(bufferViewId, bufferId) {
        self.quassel.requestHideBufferPermanently(bufferViewId, bufferId);
      }
      
      function requestRenameBuffer(bufferId, name) {
        self.quassel.requestRenameBuffer(bufferId, name);
      }
      
      function requestUpdateAliasManager(aliases) {
        self.quassel.requestUpdateAliasManager(aliases);
      }
      
      function requestUpdateIgnoreListManager(ignoreList) {
        self.quassel.requestUpdateIgnoreListManager(ignoreList);
      }
      
      function requestSetNetworkInfo(networkId, network) {
        self.quassel.requestSetNetworkInfo(networkId, network);
      }
      
      function createNetwork(networkName, identityId, initialServer, optionsopt) {
        self.quassel.createNetwork(networkName, identityId, initialServer, optionsopt);
      }
      
      function removeNetwork(networkId) {
        self.quassel.removeNetwork(networkId);
      }
      
      function createIdentity(identityName, options) {
        self.quassel.createIdentity(identityName, options);
      }
      
      function removeIdentity(identityId) {
        self.quassel.removeIdentity(identityId);
      }
      
      function requestUpdateIdentity(identityId, identity) {
        self.quassel.requestUpdateIdentity(identityId, identity);
      }
      
      function requestCreateBufferView(data) {
        self.quassel.requestCreateBufferView(data);
      }
      
      function connect() {
        self.quassel.connect();
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
