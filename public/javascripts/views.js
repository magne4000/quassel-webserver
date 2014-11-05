var MT = require('message').Type;
var Views = {utils: {}};
var hideClasses = (function(){
	var nbpow = 17, i = 1, max = i << nbpow, classes = [];
	while (i <= max) {
		classes.push("hide-" + i);
		i = i << 1;
	}
	return classes.join(" ");
})();

Views._decorator = {sender: {}, content: {}};
//Views._decorator.sender[MT.Notice] = '';
//Views._decorator.sender[MT.Action] = '';
Views._decorator.sender[MT.Nick] = '<->';
Views._decorator.sender[MT.Mode] = '***';
Views._decorator.sender[MT.Join] = '-->';
Views._decorator.sender[MT.Part] = '<--';
Views._decorator.sender[MT.Quit] = '<--';
Views._decorator.sender[MT.Kick] = '<-*';
//Views._decorator.sender[MT.Kill] = '';
Views._decorator.sender[MT.Server] = function(nick) {
	return nick || "*";
};
//Views._decorator.sender[MT.Info] = '';
//Views._decorator.sender[MT.Error] = '';
//Views._decorator.sender[MT.DayChange] = '-';
Views._decorator.sender[MT.Topic] = '*';
Views._decorator.sender[MT.NetsplitJoin] = '=>';
Views._decorator.sender[MT.NetsplitQuit] = '<=';
//Views._decorator.sender[MT.Invite] = '';

//Views._decorator.content[MT.Notice] = '';
//Views._decorator.content[MT.Action] = '';
Views._decorator.content[MT.Nick] = function(nick, content) {
	return Views.utils.stripnick(nick) + " is now known as " + content;
};
Views._decorator.content[MT.Mode] = function(nick, content) {
	return "Mode " + content + " by " + Views.utils.stripnick(nick);
};
Views._decorator.content[MT.Join] = function(nick, content) {
	return Views.utils.stripnick(nick) + " has joined";
};
Views._decorator.content[MT.Part] = function(nick, content) {
	return Views.utils.stripnick(nick) + " has left";
};
Views._decorator.content[MT.Quit] = function(nick, content) {
	return Views.utils.stripnick(nick) + " has quit";
};
Views._decorator.content[MT.Kick] = function(nick, content) {
	var ind = content.indexOf(" ");
	return Views.utils.stripnick(nick) + " has kicked " + content.slice(0, ind) + " (" + content.slice(ind+1) + ")";
};
//Views._decorator.content[MT.Kill] = '';
//Views._decorator.content[MT.Server] = '';
//Views._decorator.content[MT.Info] = '';
//Views._decorator.content[MT.Error] = '';
//Views._decorator.content[MT.DayChange] = '-';
//Views._decorator.content[MT.Topic] = ''; // as is
//Views._decorator.content[MT.NetsplitJoin] = ''; // as is
//Views._decorator.content[MT.NetsplitQuit] = '<='; // as is
//Views._decorator.content[MT.Invite] = '';

var tagsToReplace = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	'\'': '&#x27;',
	'/': '&#x2F;'
}, re = /[&<>]/g;

Views.utils.makeLinks = function(str) {
	if (!str) return null;
	return str.replace(re, function (tag) {
		return tagsToReplace[tag] || tag;
	});
};

Views.utils.escapetags = function(str) {
	if (!str) return null;
	return str.replace(re, function (tag) {
		return tagsToReplace[tag] || tag;
	});
};

Views.utils.stripname = function(s) {
	if (!s) return '';
	if (s[0] === '#') {
		return s.substring(1);
	}
	return s;
};

Views.utils.stripnick = function(s) {
	if (!s) return '';
	var ind = s.indexOf('!');
	if (ind !== -1) {
		return s.slice(0, ind);
	}
	return s;
};

Views.utils.HHmmss = function(d) {
	var dateObject = null;
	if (d instanceof Date) {
		dateObject = d;
	} else {
		dateObject = new Date(d);
	}
	var h = dateObject.getHours(), m = dateObject.getMinutes(), s = dateObject.getSeconds();
	if (h < 10) h = '0'+h;
	if (m < 10) m = '0'+m;
	if (s < 10) s = '0'+s;
	return [h, m, s].join(':');
};

Views.utils.hashCode = function(s) {
  var hash = 0, i, chr, len;
  if (s.length == 0) return hash;
  for (i = 0, len = s.length; i < len; i++) {
    chr   = s.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

Views.utils.nickHash = function(s) {
	return Math.abs(Views.utils.hashCode(s)) % 16;
};


Views.alert = function(message) {
	$(".alert").removeClass("hidden");
	$(".alert .alert-text").html(message);
};

Views._network = function(name, isConnected) {
	var activeclass = isConnected?"on":"off";
	return '<div class="network '+activeclass+'" id="network-'+name+'">' + 
		'<span class="'+(isConnected ? 'expanded' : 'collapsed')+'" data-target="'+name+'-channels" ></span>' +
		'<span class="network-name">'+name+'</span>' +
		'<a class="add-channel" data-network="'+name+'" data-toggle="modal" data-target="#modal-join-channel" title="Join channel"></a>' +
	'</div>' +
	'<div class="network-channels clearfix" id="'+name+'-channels" style="'+(isConnected ? '' : 'max-height:0px;')+'"></div>';
};

Views._buffer = function(bufferId, name, active) {
	var activeclass = active?"on":"off";
	return '<div class="channel '+activeclass+'" data-buffer-id="'+bufferId+'">' + 
		'<span class="channel-icon"></span>' + 
		'<span class="channel-name">'+name+'</span>' + 
	'</div>';
};

Views._bufferline = function(type, datetime, sender, content, highlight) {
	var htmlcontent = Views.utils.escapetags(content), classes = ["irc-message", "type-"+type];
	if (type == MT.Plain) {
		htmlcontent = Autolinker.link(htmlcontent, {stripPrefix: false, email: false, twitter: false});
	}
	if (highlight) classes.push("highlighted");
	return '<li class="'+classes.join(" ")+'">'+
	'<span class="timestamp"><span>'+Views.utils.HHmmss(datetime)+'</span></span>'+
	'<span class="nick" data-nickhash="'+(Views.utils.nickHash(sender) % 16)+'">'+Views.utils.escapetags(Views.utils.stripnick(sender))+'</span>'+
	'<span class="message">'+htmlcontent+'</span></li>';
};

Views._userline = function(nick) {
	return '<div class="user" data-nick="'+nick+'">'+
	'<span class="user-icon user-icon-active"></span>'+
	'<span class="user-name">'+Views.utils.escapetags(nick)+'</span></div>';
};

Views.decorateSender = function(type, sender) {
	var dec = Views._decorator.sender[type];
	if (typeof dec === 'string') return dec;
	if (typeof dec === 'function') return dec(sender);
	return sender;
};

Views.decorateContent = function(type, sender, content) {
	var dec = Views._decorator.content[type];
	if (typeof dec === 'string') return dec;
	if (typeof dec === 'function') return dec(sender, content);
	return content;
};

Views.clearUsers = function() {
	$('#users-user, #users-voiced, #users-operator').html("");
};

Views.addUser = function(buffer, user) {
	var userline = Views._userline(user.nick);
	if (buffer.isOp(user.nick)) {
		$('#users-operator').append(userline);
	} else if (buffer.isVoiced(user.nick)) {
		$('#users-voiced').append(userline);
	} else {
		$('#users-user').append(userline);
	}
};

Views.removeUser = function(buffer, nick) {
	$('.group-users [data-nick="'+nick+'"]').remove();
};

Views.addNetwork = function(network) {
	var networkNames = $('.network'), names = [], networkIds = [], i = 0;
	var html = Views._network(network.networkName, network.isConnected);
	var lowercaseName = network.networkName.toLowerCase(), spot = null;
	networkNames.each(function(){
		names.push($(this).children(".network-name").text().toLowerCase());
		networkIds.push($(this).attr("id"));
	});
	for (; i<names.length && spot === null; i++) {
		if (lowercaseName.localeCompare(names[i]) < 0) {
			spot = i;
		}
	}
	if (spot === null) {
		$('#buffer-pane .buffer-container').append(html);
	} else {
		$("#"+networkIds[spot]).before(html);
	}
};

Views.addBuffer = function(networkname, buffer) {
	// Keep buffer ordered alphabetically
	var channels = $('#'+networkname+'-channels .channel'), names = [], bufferIds = [], i = 0;
	var html = Views._buffer(buffer.id, buffer.name, buffer.active);
	var lowercaseName = buffer.name.toLowerCase(), spot = null;
	channels.each(function(){
		names.push($(this).text().toLowerCase());
		bufferIds.push(parseInt($(this).attr("data-buffer-id"), 10));
	});
	for (; i<names.length && spot === null; i++) {
		if (lowercaseName.localeCompare(names[i]) < 0) {
			spot = i;
		}
	}
	if (spot === null) {
		$('#'+networkname+'-channels').append(html);
	} else {
		$(".channel[data-buffer-id="+bufferIds[spot]+"]").before(html);
	}
};

Views.bufferHighlight = function(bufferId, message) {
	$(".channel[data-buffer-id="+bufferId+"]").addClass("buffer-newevent");
	if (typeof message !== "undefined") {
		reviver.afterReviving(message, function(obj) {
			if (obj.type == MT.Plain || obj.type == MT.Action) {
				$(".channel[data-buffer-id="+bufferId+"]").addClass("buffer-newmessage");
			}
			if (obj.isHighlighted()) {
				$(".channel[data-buffer-id="+bufferId+"]").addClass("buffer-highlight");
			}
		});
	}
};

Views.bufferMarkAsRead = function(bufferId) {
	$(".channel[data-buffer-id="+bufferId+"]").removeClass("buffer-newevent buffer-newmessage buffer-highlight");
};

Views.setStatusBuffer = function(networkname, buffer) {
	$('#network-'+networkname+' .network-name').attr("data-buffer-id", buffer.id);
};

Views.getMessage = function(message) {
	var sender = Views.decorateSender(message.type, message.sender);
	var content = Views.decorateContent(message.type, message.sender, message.content);
	return Views._bufferline(message.type, message.datetime, sender, content, message.isHighlighted());
};

Views.addMessage = function(message, callback) {
	reviver.afterReviving(message, function(obj) {
		$(".backlog").append(Views.getMessage(obj));
		if (typeof callback === "function") {
			callback();
		}
	});
};

Views.prependMessage = function(message) {
	reviver.afterReviving(message, function(obj) {
		$(".backlog").prepend(Views.getMessage(obj));
	});
};

Views.setMarkerLine = function(messageId) {
	$(".irc-message[data-message-id="+messageId+"]").addClass("markerline");
};

Views.clearMarkerLine = function(bufferId) {
	if (Views.isBufferShown(bufferId)) {
		$(".irc-message.markerline").removeClass("markerline");
	}
};

Views.isBufferShown = function(bufferId) {
	return $(".backlog").data('currentBufferId') == bufferId;
};

Views.showBuffer = function(buffer) {
	var backlogs = [], lastMessageId;
	Views.updateMessageTypes(buffer.id);
	buffer.messages.forEach(function(val, key) {
		backlogs.push(Views.getMessage(val));
		lastMessageId = val.id;
	}, function(a, b) {
		return a.id - b.id;
	});
	$(".backlog").html(backlogs.join("\n")).data('currentBufferId', buffer.id);
	Views.scrollToBottom();
	if (buffer.topic) {
		$("#topic").text(buffer.topic);
	} else {
		$("#topic").html("");
	}
	Views.clearUsers();
	Views.showUsers(buffer);
	Views.selectBuffer(buffer.id);
	return lastMessageId;
};

Views.showUsers = function(buffer) {
	var users = [];
	for (var nick in buffer.nickUserMap) {
		users.push(buffer.nickUserMap[nick]);
	}
	users.sort(function(a, b) {
		return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
	});
	for (var i in users) {
		Views.addUser(buffer, users[i]);
	}
};

Views.showBuffers = function() {
	$("#show-buffers").hide();
    $("#hide-buffers").show();
    $("#buffer-pane").removeClass("col-md-0").addClass("col-md-2");
    $("#buffer-pane .buffer-container").css("opacity", "1");
};

Views.hideBuffers = function() {
	$("#show-buffers").show();
    $("#hide-buffers").hide();
    $("#buffer-pane").removeClass("col-md-2").addClass("col-md-0");
    $("#buffer-pane .buffer-container").css("opacity", "0");
};

Views.showNicks = function() {
	$("#show-nicks").hide();
    $("#hide-nicks").show();
    $("#nick-pane").removeClass("col-md-0").addClass("col-md-2");
    $("#nick-pane .buffer-container").css("opacity", "1");
};

Views.hideNicks = function() {
	$("#show-nicks").show();
    $("#hide-nicks").hide();
    $("#nick-pane").removeClass("col-md-2").addClass("col-md-0");
    $("#nick-pane .buffer-container").css("opacity", "0");
};

Views.removeBuffer = function(bufferId) {
	$(".channel[data-buffer-id="+bufferId+"]").remove();
};

Views.hideBuffer = function(bufferId) {
	$(".channel[data-buffer-id="+bufferId+"]").addClass("hidden");
};

Views.unhideBuffer = function(bufferId) {
	$(".channel[data-buffer-id="+bufferId+"]").removeClass("hidden");
};

Views.activateBuffer = function(bufferId)  {
	$(".channel[data-buffer-id="+bufferId+"]").removeClass("off").addClass("on");
};

Views.deactivateBuffer = function(bufferId)  {
	$(".channel[data-buffer-id="+bufferId+"]").removeClass("on").addClass("off");
};

Views.selectBuffer = function(bufferId) {
	$(".channel[data-buffer-id]").removeClass("selected");
	$(".channel[data-buffer-id="+bufferId+"]").addClass("selected");
};

Views.connecting = function()  {
	$("body").removeClass("disconnected").addClass("connecting");
};

Views.connected = function()  {
	$("body").removeClass("disconnected connecting");
	$("#messagebox").removeAttr("disabled");
	$(".btn-connect").removeAttr("disabled");
};

Views.disconnected = function() {
	$("body").removeClass("connecting").addClass("disconnected");
	$("#messagebox").attr("disabled", "disabled");
	$(".btn-connect").attr("disabled", "disabled");
};

Views.clear = function() {
	$("#buffer-pane .buffer-container").html("");
	$("#backlog-container .backlog").html("");
	$("#nick-pane .group-users").html("");
};

Views.showLoginPage = function() {
	Views.clear();
	$(".login").removeClass("hidden");
	$(".logged").addClass("hidden");
};

Views.showQuassel = function() {
	$('.login-page').removeClass('login-page');
	$('.container.login').addClass('hidden');
	$('.logged').removeClass('hidden');
};

Views.scrollToBottom = function() {
	$(".backlog").scrollTop($('.backlog').get(0).scrollHeight);
};

Views.scrollOnNewMessage = function() {
	var backlogDom = $('.backlog').get(0);
	var scrollBottom = backlogDom.scrollHeight - backlogDom.scrollTop - 35;
	var height = $('.backlog').height();
	if (scrollBottom <= height) {
		$(".backlog").scrollTop(backlogDom.scrollHeight);
	}
};

Views.useDefaultFilter = function() {
	var bufferId = parseInt($(".backlog").data('currentBufferId'), 10);
	var filter = localStorage.getItem("filtered-types-buffer-"+bufferId);
	if (filter !== null) {
		localStorage.setItem("filtered-types-default", filter);
		localStorage.removeItem("filtered-types-buffer-"+bufferId);
	}
	$('.prefs input[data-default-filter]').prop("checked", true);
};

Views.doNotUseDefaultFilter = function() {
	var bufferId = parseInt($(".backlog").data('currentBufferId'), 10);
	var filter = localStorage.getItem("filtered-types-default");
	if (filter === null) {
		filter = "[]";
	}
	localStorage.setItem("filtered-types-buffer-"+bufferId, filter);
	$('.prefs input[data-default-filter]').prop("checked", false);
};


Views.updateMessageTypes = function(bufferId) {
	$(".prefs input").prop("checked", false);

	// Buffer specific filter.
	var isUsingDefaultFilter = false;
	var filter = localStorage.getItem("filtered-types-buffer-"+bufferId);
	if (filter === null) { 
		// Use Default filter
		isUsingDefaultFilter = true;
		filter = localStorage.getItem("filtered-types-default");
	}
	
	if (filter !== null) {
		filter = JSON.parse(filter);
		for (var i=0; i<filter.length; i++) {
			$(".backlog").addClass("hide-"+filter[i]);
			$('.prefs input[data-message-type="'+filter[i]+'"]').prop("checked", true);
		}
	}
	$('.prefs input[data-default-filter]').prop("checked", isUsingDefaultFilter);
};

Views.showMessageTypes = function(type) {
	var bufferId = parseInt($(".backlog").data('currentBufferId'), 10);
	$('.prefs input[data-default-filter]').prop("checked", false);
	var filter = localStorage.getItem("filtered-types-buffer-"+bufferId) || localStorage.getItem("filtered-types-default") || "[]";
	filter = JSON.parse(filter);
	var ind = filter.indexOf(type);
	if (ind !== -1) {
		filter.splice(ind, 1);
	}
	localStorage.setItem("filtered-types-buffer-"+bufferId, JSON.stringify(filter));
	$(".backlog").removeClass("hide-"+type);
};

Views.hideMessageTypes = function(type) {
	var bufferId = parseInt($(".backlog").data('currentBufferId'), 10);
	$('.prefs input[data-default-filter]').prop("checked", false);
	var filter = localStorage.getItem("filtered-types-buffer-"+bufferId) || localStorage.getItem("filtered-types-default") || "[]";
	filter = JSON.parse(filter);
	if (filter.indexOf(type) === -1) {
		filter.push(type);
	}
	localStorage.setItem("filtered-types-buffer-"+bufferId, JSON.stringify(filter));
	$(".backlog").addClass("hide-"+type);
};
