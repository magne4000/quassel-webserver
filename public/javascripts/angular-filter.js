/* global libquassel */
/* global angular */

angular.module('quassel')
.filter('decoratenick', ['stripnickFilter', function(stripnick) {
    var MT = libquassel.message.Types;

    return function(message) {
        var sender;
        switch(message.type) {
            case MT.NICK:
                sender = '<->';
                break;
            case MT.MODE:
                sender = '***';
                break;
            case MT.JOIN:
                sender = '-->';
                break;
            case MT.PART:
                sender = '<--';
                break;
            case MT.QUIT:
                sender = '<--';
                break;
            case MT.KICK:
                sender = '<-*';
                break;
            case MT.SERVER:
                sender = stripnick(message.sender) || "*";
                break;
            case MT.TOPIC:
                sender = '*';
                break;
            case MT.NETSPLITJOIN:
                sender = '=>';
                break;
            case MT.NETSPLITQUIT:
                sender = '<=';
                break;
            case MT.DAYCHANGE:
                sender = '-';
                break;
            default:
                sender = stripnick(message.sender);
        }
        return sender;
    };
}])
.filter('channelsFilter', function() {
    return function(channels, bufferView, showhidden) {
        if (!bufferView) return [];
        channels = channels || [];
        var out = channels.filter(function(channel){
            return !channel._isStatusBuffer && (showhidden || !bufferView.isHidden(channel.id)) && (!bufferView.hideInactiveBuffers || channel.active);
        });
        
        return out;
    };
})
.filter('stripnick', function() {
    return function(input) {
        if (typeof input === 'string') {
            var ind = input.indexOf('!');
            if (ind !== -1) {
                return input.slice(0, ind);
            }
            return input;
        }
        return '';
    };
})
.filter('duration', function() {
    return function(input) {
        var dateObject = null;
        if (input instanceof Date) {
            dateObject = input;
        } else {
            dateObject = new Date(input);
        }
        var h = dateObject.getHours(), m = dateObject.getMinutes(), s = dateObject.getSeconds();
        if (h < 10) h = '0'+h;
        if (m < 10) m = '0'+m;
        if (s < 10) s = '0'+s;
        return [h, m, s].join(':');
    };
})
.filter('color', function() {
    var COLOR = new RegExp("^" + String.fromCharCode(3) + "(([0-9]{1,2})(,([0-9]{1,2}))?)");
    return function(input) {
        var out = '',
        contextAttributes = {
            bold: false,
            italic: false,
            underline: false,
            bgcolor: false,
            fgcolor: false
        },
        i = 0,
        tagOpened = false,
        match;
        input = input || '';

        var openSpan = function (classes) {
            return '<span class="' + classes + '">';
        };

        var closeSpan = function () {
            return '</span>';
        };

        var unescapeColorTags = function(str) {
            var tagsToReplace = {
                '&#2;': '\x02',
                '&#29;': '\x1D',
                '&#31;': '\x1F',
                '&#3;': '\x03',
                '&#15;': '\x0F'
            };
            var re = /&#(2|29|3|31|15);/g;
            return str.replace(re, function (tag) {
                return tagsToReplace[tag] || tag;
            });
        };

        var getClasses = function () {
            var prop, ret = [];
            for (prop in contextAttributes) {
                if (contextAttributes[prop] !== false) {
                    ret.push(contextAttributes[prop]);
                }
            }
            return ret;
        };

        var getTags = function() {
            var ret = "", classes = getClasses();
            if (tagOpened) {
                ret += closeSpan();
                tagOpened = false;
            }
            if (classes.length > 0) {
                ret += openSpan(classes.join(" "));
                tagOpened = true;
            }
            return ret;
        };

        input = unescapeColorTags(input);

        for (i = 0; i < input.length; i++) {
            switch (input[i]) {
                case '\x02':
                    contextAttributes.bold = contextAttributes.bold ? false : 'mirc-bold';
                    out += getTags();
                    break;
                case '\x1D':
                    contextAttributes.italic = contextAttributes.italic ? false : 'mirc-italic';
                    out += getTags();
                    break;
                case '\x1F':
                    contextAttributes.underline = contextAttributes.underline ? false : 'mirc-underline';
                    out += getTags();
                    break;
                case '\x03':
                    match = input.substr(i, 6).match(COLOR);
                    if (match) {
                        i += match[1].length;
                        // 2 & 4
                        contextAttributes.fgcolor = "mirc-fg-" + parseInt(match[2], 10);
                        if (match[4]) {
                            contextAttributes.bgcolor = "mirc-bg-" + parseInt(match[4], 10);
                        }
                    } else {
                        contextAttributes.bgcolor = false;
                        contextAttributes.fgcolor = false;
                    }
                    out += getTags();
                    break;
                case '\x0F':
                    contextAttributes.bold = contextAttributes.italic = contextAttributes.underline = contextAttributes.fgcolor = contextAttributes.bgcolor = false;
                    out += getTags();
                    break;
                default:
                    out += input[i];
                    break;
            }
        }
        if (tagOpened) {
            out += closeSpan();
        }
        return out;
    };
})
.filter('escape', function() {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#x27;',
        '/': '&#x2F;'
    }, re = /[&<>]/g;
    return function(input) {
        if (typeof input === 'string') {
            return input.replace(re, function (tag) {
                return tagsToReplace[tag] || tag;
            });
        }
        return '';
    };
})
.filter('hash', function() {
    return function(input) {
        if (!input) return null;
        var hash = 5381, i, chr, len;
        for (i = 0, len = input.length; i < len; i++) {
            chr   = input.charCodeAt(i);
            hash  = ((hash << 5) + hash) + chr;
        }
        return Math.abs(hash) % 16;
    };
})
.filter('usertitle', function() {
    
    function getModesLine(user, buffer) {
        var mapValue = buffer.users.get(user.nick);
        return mapValue && mapValue.modes ? "Modes: " + mapValue.modes : null;
    }
    
    function getAwayMessageLine(user) {
        return user.away ? "Away message: " + (user.awayMessage ? user.awayMessage : "Unknown") : null;
    }
    
    function getRealNameLine(user) {
        return user.realName ? "Realname: " + user.realName : null;
    }
    
    function getHostmaskLine(user) {
        var hostmask = user.id.slice(user.id.indexOf('!') + 1);
        return hostmask != "@" ? "Hostmask: " + hostmask : null;
    }
    
    function getOperatorLine(user) {
        return user.ircOperator ? "Operator: " + user.ircOperator.replace("is an ", "").replace("is a ", "") : null;
    }
    
    function getServerLine(user) {
        return user.server ? "Server: " + user.server : null;
    }
    
    function genTitle(a) {
        var s = '', newline = '';
        for (var i=0; i<a.length; i++) {
            if (a[i] !== null) {
                s += newline + a[i];
                newline = '\n';
            }
        }
        return s;
    }
    
    return function(user, buffer) {
        var a = [];
        a.push(getModesLine(user, buffer));
        a.push(getAwayMessageLine(user));
        a.push(getRealNameLine(user));
        // TODO add account (account-notify functionnality)
        // see https://github.com/quassel/quassel/blob/d29a6e9521e27e5d4d86fec82b5daa71085f87a5/src/client/networkmodel.cpp#L1146
        a.push(getHostmaskLine(user));
        a.push(getOperatorLine(user));
        // TODO idle time
        // TODO login time
        a.push(getServerLine(user));
        return genTitle(a);
    };
})
.filter('ordernicks', function() {
    return function(users, buffer) {
        if (!users || buffer === null) return users;
        var owner = [], admin = [], op = [], halfop = [], voiced = [], other = [];

        users.forEach(function(value) {
            var user = value.user;
            if (buffer.hasUser(user.nick)) {
                var bufferUser = buffer.users.get(user.nick);
                
                if (bufferUser.isOwner) owner.push(user);
                else if (bufferUser.isAdmin) admin.push(user);
                else if (bufferUser.isOp) op.push(user);
                else if (bufferUser.isHalfOp) halfop.push(user);
                else if (bufferUser.isVoiced) voiced.push(user);
                else other.push(user);
            }
        });

        function sortNicks(a, b){
            return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
        }

        owner.sort(sortNicks);
        admin.sort(sortNicks);
        op.sort(sortNicks);
        halfop.sort(sortNicks);
        voiced.sort(sortNicks);
        other.sort(sortNicks);
        return owner.concat(admin, op, halfop, voiced, other);
    };
});
