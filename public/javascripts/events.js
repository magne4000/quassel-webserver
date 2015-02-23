/*
 * libquassel
 * https://github.com/magne4000/node-libquassel
 *
 * Copyright (c) 2014 Joël Charles
 * Licensed under the MIT license.
 */

angular.module('er', ['ngSocket'])
.factory('$er', ['$socket', function EventReceiver($socket) {
        var old = [];
        var allafterevents = [];
        var oncallback = function() {};
        var conditions = [];
        var events = [];
        var definition = {
            'login': null,
            'loginfailed': null,
            'init': null,
            '_init': null,
            'network.init': ["networkId"],
            'network._init': ["networkId"],
            'network.addbuffer': ["networkId", "bufferId"],
            'network.latency': ["networkId", "latency"],
            'network.connectionstate': ["networkId", "connectionState"],
            'network.connected': ["networkId"],
            'network.disconnected': ["networkId"],
            'network.mynick': ["networkId", "nick"],
            'network.networkname': ["networkId", "networkName"],
            'network.server': ["networkId", "server"],
            'network.userrenamed': ["networkId", "nick", "newNick"],
            'network.new': ["networkId"],
            'network.remove': ["networkId"],
            'network.adduser': ["networkId", "nick"],
            'buffer.read': ["bufferId"],
            'buffer.lastseen': ["bufferId", "messageId"],
            'buffer.highlight': ["bufferId", "messageId"],
            'buffer.remove': ["bufferId"],
            'buffer.rename': ["bufferId", "bufferName"],
            'buffer.merge': ["bufferId", "bufferId"],
            'buffer.activate': ["bufferId"],
            'buffer.deactivate': ["bufferId"],
            'buffer.message': ["bufferId", "messageId"],
            'buffer.backlog': ["bufferId", "messageIds"],
            'buffer.unhide': ["bufferId"],
            'buffer.hidden': ["bufferId", "hiddenType"],
            'buffer.order': ["bufferId", "order"],
            'user.part': ["networkId", "nick", "bufferName"],
            'user.quit': ["networkId", "nick"],
            'user.away': ["networkId", "nick", "isAway"],
            'user.realname': ["networkId", "nick", "realName"],
            'channel.join': ["bufferId", "nick"],
            'channel.addusermode': ["bufferId", "nick", "mode"],
            'channel.removeusermode': ["bufferId", "nick", "mode"],
            'channel.topic': ["bufferId", "topic"]
        };
        
        var ConditionedEventReceiver = function ConditionedEventReceiver(event) {
            this.event = event;
            this.afterevents = [];
            this.pending = [];
            this.pendingtimeout;
        };
        
        ConditionedEventReceiver.prototype._store = function(event, args, callback) {
            this.pending.push({
                event: event,
                callback: callback,
                args: args
            });
        };
        
        ConditionedEventReceiver.prototype.after = function(event) {
            if (this.afterevents.indexOf(event) === -1) {
                this.afterevents.push(event);
                if (allafterevents.indexOf(event) === -1) {
                    allafterevents.push(event);
                }
            }
            return this;
        };
        
        ConditionedEventReceiver.prototype._call = function(event, args, callback) {
            var argsclone = args.slice(0),
                self = this;
            argsclone.unshift(function() {
                if (allafterevents.indexOf(event) !== -1) {
                    // Store this event only if at least one 'after' function references it.
                    // It avoids having a large array to walk in '_check' function.
                    old.push({
                        event: event,
                        args: args
                    });
                }
                clearTimeout(self.pendingtimeout);
                self.pendingtimeout = setTimeout(function() {
                    self._pending();
                }, 100);
            });
            callback.apply($socket, argsclone);
        };
        
        ConditionedEventReceiver.prototype._pending = function() {
            for (var j = 0; j < conditions.length; j++) {
                var condition = conditions[j];
                var pendingcopy = condition.pending.slice(0),
                    toSplice = [],
                    i;
                for (i = 0; i < pendingcopy.length; i++) {
                    if (condition._check(pendingcopy[i].event, pendingcopy[i].args)) {
                        this._call(pendingcopy[i].event, pendingcopy[i].args, pendingcopy[i].callback);
                        toSplice.push(i);
                    }
                }
                for (i = toSplice.length - 1; i >= 0; i--) {
                    conditions[j].pending.splice(toSplice[i], 1);
                }
            }
        };
        
        ConditionedEventReceiver.prototype._check = function(event, args) {
            if (definition[event] === null || typeof definition[event] === 'undefined' || definition[event].length === 0 || this.afterevents.length === 0) return true;
            var nb = this.afterevents.length;
            for (var ind in old) {
                var thisone = true;
                if (this.afterevents.indexOf(old[ind].event) !== -1) {
                    // All of "after" events must have been fired before firing the current one
                    for (var i in definition[event]) {
                        // We compare the parameters to know if this is the good parent event that was fired
                        var arg = definition[event][i];
                        if (definition[old[ind].event]) {
                            var indexOfOldEventArg = definition[old[ind].event].indexOf(arg);
                            if (indexOfOldEventArg !== -1) {
                                // The current argument (e.g. networkId) is in both events, so we compare them.
                                // If they don't match, we can check another old event
                                if (old[ind].args[indexOfOldEventArg] != args[i]) thisone = false;
                            }
                        }
                        if (!thisone) break;
                    }
                }
                else {
                    thisone = false;
                }
                if (thisone) {
                    nb--;
                }
            }
            return (nb <= 0);
        };
        
        return {
            setCallback: setCallback,
            on: on,
            removeAllListeners: removeAllListeners,
            clearReceived: clearReceived,
            redoCallbacks: redoCallbacks
        };
    
        function setCallback(value) {
            oncallback = value;
        }
    
        function on(event, callback) {
            oncallback(event);
            events.push(event);
            var condition = new ConditionedEventReceiver(event);
            conditions.push(condition);
            $socket.on(event, function() {
                var args = Array.prototype.slice.call(arguments);
                if (condition._check(event, args)) {
                    condition._call(event, args, callback);
                } else {
                    console.log(event, args);
                    condition._store(event, args, callback);
                }
            });
            return condition;
        }
    
        function removeAllListeners() {
            for (var ind in events) {
                $socket.removeAllListeners(events[ind]);
            }
            events = [];
        }
    
        function clearReceived() {
            old = [];
        }
    
        function redoCallbacks() {
            for (var ind in events) {
                oncallback(events[ind]);
            }
        }
    }
]);