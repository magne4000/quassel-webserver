/*
 * libquassel
 * https://github.com/magne4000/node-libquassel
 *
 * Copyright (c) 2014 Joël Charles
 * Licensed under the MIT license.
 */

var EventReceiver = function EventReceiver(obj, oncallback) {
	this.obj = obj;
	this.old = [];
	this.oncallback = oncallback;
	this.conditions = [];
	this.events = [];
};

EventReceiver.prototype.on = function(event, callback) {
	this.oncallback(event);
	this.events.push(event);
	var condition = new ConditionedEventReceiver(event, this);
	this.conditions.push(condition);
	this.obj.on(event, function() {
		var args = Array.prototype.slice.call(arguments);
		if (condition._check(event, args)) {
			condition._call(event, args, callback);
		} else {
			console.log(event, args);
			condition._store(event, args, callback);
		}
	});
	return condition;
};

EventReceiver.prototype.removeAllListeners = function() {
	for (var ind in this.events) {
		this.obj.removeAllListeners(this.events[ind]);
	}
	this.events = [];
};

EventReceiver.prototype.clearReceived = function() {
	this.old = [];
	this.pending = [];
};

EventReceiver.prototype.redoCallbacks = function() {
	for (var ind in this.events) {
		this.oncallback(this.events[ind]);
	}
};

var ConditionedEventReceiver = function ConditionedEventReceiver(event, obj) {
	this.event = event;
	this.afterevents = [];
	this.eventreceiver = obj;
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
	}
	return this;
};

ConditionedEventReceiver.prototype._call = function(event, args, callback) {
	var argsclone = args.slice(0), self = this;
	argsclone.unshift(function(){
		self.eventreceiver.old.push({
			event: event,
			args: args
		});
		clearTimeout(self.pendingtimeout);
		self.pendingtimeout = setTimeout(function(){
			self._pending();
		}, 100);
	});
	callback.apply(this.eventreceiver.obj, argsclone);
};

ConditionedEventReceiver.prototype._pending = function() {
	for (var j = 0; j<this.eventreceiver.conditions.length; j++) {
		var condition = this.eventreceiver.conditions[j];
		var pendingcopy = condition.pending.slice(0), toSplice = [], i;
		for (i = 0; i<pendingcopy.length; i++) {
			if (condition._check(pendingcopy[i].event, pendingcopy[i].args)) {
				this._call(pendingcopy[i].event, pendingcopy[i].args, pendingcopy[i].callback);
				toSplice.push(i);
			}
		}
		for (i = toSplice.length - 1; i >= 0; i--) {
			this.eventreceiver.conditions[j].pending.splice(toSplice[i], 1);
		}
	}
};

ConditionedEventReceiver.prototype._check = function(event, args) {
	if (EventReceiver.definition[event] === null
		|| typeof EventReceiver.definition[event] === 'undefined'
		|| EventReceiver.definition[event].length === 0
		|| this.afterevents.length === 0) return true;
	var nb = this.afterevents.length;
	for (var ind in this.eventreceiver.old) {
		var thisone = true;
		if (this.afterevents.indexOf(this.eventreceiver.old[ind].event) !== -1) {
			// All of "after" events must have been fired before firing the current one
			for (var i in EventReceiver.definition[event]) {
				// We compare the parameters to know if this is the good parent event that was fired
				var arg = EventReceiver.definition[event][i];
				if (EventReceiver.definition[this.eventreceiver.old[ind].event]) {
					var indexOfOldEventArg = EventReceiver.definition[this.eventreceiver.old[ind].event].indexOf(arg);
					if (indexOfOldEventArg !== -1) {
						// The current argument (e.g. networkId) is in both events, so we compare them.
						// If they don't match, we can check another old event
						if (this.eventreceiver.old[ind].args[indexOfOldEventArg] != args[i]) thisone = false;
					}
				}
				if (!thisone) break;
			}
		} else { thisone = false; }
		if (thisone) {
			nb--;
		}
	}
	return (nb <= 0);
};

EventReceiver.definition = {
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
	'channel.topic': ["bufferId", "topic"],
	'change': ["networkId"]
};
