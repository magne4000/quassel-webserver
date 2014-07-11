var Views = {};
Views.utils = {};

var tagsToReplace = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	'\'': '&#x27;',
	'/': '&#x2F;'
}, re = /[&<>]/g;

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

Views.alert = function(message) {
	$(".alert").removeClass("hidden");
	$(".alert .alert-text").html(message);
};

Views._network = function(name) {
	return '<div class="network" id="network-'+name+'">' + 
		'<span class="expanded" data-target="'+name+'-channels" ></span>' +
		'<span class="network-name">'+name+'</span>' +
		'<a class="add-channel" data-network="'+name+'" data-toggle="modal" data-target="#modal-join-channel" title="Join channel"></a>' +
	'</div>' +
	'<div class="network-channels clearfix" id="'+name+'-channels"></div>';
};

Views._buffer = function(bufferId, name) {
	return '<div class="channel off" data-buffer-id="'+bufferId+'">' + 
		'<span class="channel-icon"></span>' + 
		'<span class="channel-name">'+name+'</span>' + 
	'</div>';
};

Views._bufferline = function(datetime, sender, content) {
	return '<li class="irc-message">'+
	'<span class="timestamp"> '+Views.utils.HHmmss(datetime)+'</span>'+
	'<span class="nick">'+Views.utils.escapetags(Views.utils.stripnick(sender))+'</span>'+
	'<span class="message">'+Views.utils.escapetags(content)+'</span></li>';
};

Views._userline = function(nick) {
	return '<div class="user">'+
	'<span class="user-icon user-icon-active"></span>'+
	'<span class="user-name">'+Views.utils.escapetags(nick)+'</span></div>';
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

Views.addNetwork = function(name) {
	$('#buffer-pane .buffer-container').append(Views._network(name));
};

Views.addBuffer = function(networkname, bufferId, name) {
	$('#'+networkname+'-channels').append(Views._buffer(bufferId, name));
};

Views.setStatusBuffer = function(networkname, bufferId) {
	$('#network-'+networkname+' .network-name').data("bufferId", bufferId);
};

Views.addMessage = function(datetime, sender, content) {
	$(".backlog").append(Views._bufferline(datetime, sender, content));
};

Views.showBuffer = function(buffer) {
	var backlogs = [];
	buffer.messages.forEach(function(val, key) {
		backlogs.push(Views._bufferline(val.datetime, val.sender, val.content));
	}, function(a, b) {
		return a.id - b.id;
	});
	$(".backlog").html(backlogs.join("\n")).data('currentBufferId', buffer.id);
	if (buffer.topic) {
		$("#topic").text(buffer.topic);
	} else {
		$("#topic").html("");
	}
	Views.clearUsers();
	Views.showUsers(buffer);
};

Views.showUsers = function(buffer) {
	for (var nick in buffer.nickUserMap) {
		Views.addUser(buffer, buffer.nickUserMap[nick]);
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

Views.hideBuffer = function(bufferId) {
	$(".channel[data-buffer-id="+bufferId+"]").addClass("hidden");
};

Views.activateBuffer = function(bufferId)  {
	$(".channel[data-buffer-id="+bufferId+"]").removeClass("off").addClass("on");
};

Views.deactivateBuffer = function(bufferId)  {
	$(".channel[data-buffer-id="+bufferId+"]").removeClass("on").addClass("off");
};

Views.connecting = function()  {
	$("body").removeClass("disconnected").addClass("connecting");
};

Views.connected = function()  {
	$("body").removeClass("disconnected connecting");
	$("#messagebox").removeAttr("disabled");
};

Views.disconnected = function() {
	$("body").removeClass("connecting").addClass("disconnected");
	$("#messagebox").attr("disabled", "disabled");
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

Views.scrollOnNewMessage = function() {
	var backlogDom = $('.backlog').get(0);
	var scrollBottom = backlogDom.scrollHeight - backlogDom.scrollTop - 35;
	var height = $('.backlog').height();
	if (scrollBottom <= height) {
		$(".backlog").scrollTop(backlogDom.scrollHeight);
	}
};
