angular.module('quassel')
.filter('decoratenick', ['stripnickFilter', function(stripnick) {
    var MT = require('message').Type;
    
    return function(message) {
        var sender;
        switch(message.type) {
            case MT.Nick:
                sender = '<->';
                break;
            case MT.Mode:
                sender = '***';
                break;
            case MT.Join:
                sender = '-->';
                break;
            case MT.Part:
                sender = '<--';
                break;
            case MT.Quit:
                sender = '<--';
                break;
            case MT.Kick:
                sender = '<-*';
                break;
            case MT.Server:
                sender = stripnick(message.sender) || "*";
                break;
            case MT.Topic:
                sender = '*';
                break;
            case MT.NetsplitJoin:
                sender = '=>';
                break;
            case MT.NetsplitQuit:
                sender = '<=';
                break;
            case MT.DayChange:
                sender = '-';
                break;
            default:
                sender = stripnick(message.sender);
        }
        return sender;
    };
}])
.filter('decoratecontent', ['stripnickFilter', 'linkyFilter', function(stripnick, linky) {
    var MT = require('message').Type;
    var dateFormat;
    if (Intl && Intl.DateTimeFormat) {
        dateFormat = new Intl.DateTimeFormat(undefined, {weekday: "long", year: "numeric", month: "long", day: "numeric"});
    } else {
        dateFormat = {
            format: function(date) {
                return date.toDateString();
            }
        };
    }
    
    return function(message) {
        var content, arr, servers;
        switch(message.type) {
            case MT.Plain:
                content = linky(message.content, '_blank');
                break;
            case MT.Nick:
                content = stripnick(message.sender) + " is now known as " + message.content;
                break;
            case MT.Mode:
                content = "Mode " + message.content + " by " + stripnick(message.sender);
                break;
            case MT.Join:
                content = stripnick(message.sender) + " has joined";
                break;
            case MT.Part:
                content = stripnick(message.sender) + " has left";
                break;
            case MT.Quit:
                content = stripnick(message.sender) + " has quit";
                break;
            case MT.Kick:
                var ind = message.content.indexOf(" ");
                content = stripnick(message.sender) + " has kicked " + message.content.slice(0, ind) + " (" + message.content.slice(ind+1) + ")";
                break;
            case MT.NetsplitJoin:
                arr = message.content.split("#:#");
                servers = arr.pop().split(" ");
                content = "Netsplit between " + servers[0] + " and " + servers[1] + " ended. Users joined: " + arr.map(stripnick).join(', ');
                break;
            case MT.NetsplitQuit:
                arr = message.content.split("#:#");
                servers = arr.pop().split(" ");
                content = "Netsplit between " + servers[0] + " and " + servers[1] + ". Users quit: " + arr.map(stripnick).join(', ');
                break;
            case MT.DayChange:
                content = "{Day changed to " + dateFormat.format(message.datetime) + "}";
                break;
            default:
                content = message.content;
        }
        return content;
    };
}])
.filter('channelsFilter', function() {
    return function(input) {
        input = input || [];
        var out = input.filter(function(elt){
            return !elt._isStatusBuffer;
        });
        out.sort(function(a, b){
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
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
        nbSpan = 0,
        nbSpanColor = 0,
        spanAttributes = {
            bold: false,
            italic: false,
            underline: false
        },
        i = 0,
        match;
    
        var openSpan = function (classes) {
            nbSpan += 1;
            return '<span class="' + classes + '">';
        };
    
        var openColorSpan = function (fgclass, bgclass) {
            nbSpanColor += 1;
            var classes = fgclass;
            if (bgclass) {
                classes += ' ' + bgclass;
            }
            return openSpan(classes);
        };
    
        var closeSpan = function () {
            nbSpan -= 1;
            return '</span>';
        };
    
        var closeColorSpan = function () {
            nbSpanColor -= 1;
            return closeSpan();
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
        
        input = unescapeColorTags(input);
    
        for (i = 0; i < input.length; i++) {
            switch (input[i]) {
                case '\x02':
                    if (spanAttributes.bold) {
                        out += closeSpan();
                    } else {
                        out += openSpan('mirc-bold');
                    }
                    spanAttributes.bold = !spanAttributes.bold;
                    break;
                case '\x1D':
                    if (spanAttributes.italic) {
                        out += closeSpan();
                    } else {
                        out += openSpan('mirc-italic');
                    }
                    spanAttributes.italic = !spanAttributes.italic;
                    break;
                case '\x1F':
                    if (spanAttributes.underline) {
                        out += closeSpan();
                    } else {
                        out += openSpan('mirc-underline');
                    }
                    spanAttributes.underline = !spanAttributes.underline;
                    break;
                case '\x03':
                    match = input.substr(i, 6).match(COLOR);
                    var classfg = false,
                        classbg = false;
                    if (match) {
                        i += match[1].length;
                        // 2 & 4
                        classfg = "mirc-fg-" + parseInt(match[2], 10);
                        if (match[4]) {
                            classbg = "mirc-bg-" + parseInt(match[4], 10);
                        }
                        out += openColorSpan(classfg, classbg);
                    } else {
                        while (nbSpanColor > 0) {
                            out += closeColorSpan();
                        }
                    }
                    break;
                case '\x0F':
                    while (nbSpan > 0) {
                        out += closeSpan();
                    }
                    spanAttributes.bold = spanAttributes.italic = spanAttributes.underline = spanAttributes.colour = false;
                    break;
                default:
                    out += input[i];
                    break;
            }
        }
        while (nbSpan > 0) {
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
.filter('ordernicks', function() {
    return function(users, buffer) {
        if (!users || buffer === null) return users;
        var op = [], voiced = [], other = [];
        
        angular.forEach(users, function(value) {
            if (buffer.isOp(value.nick)) op.push(value);
            else if (buffer.isVoiced(value.nick)) voiced.push(value);
            else other.push(value);
        });
        
        function sortNicks(a, b){
            return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
        }
        
        op.sort(sortNicks);
        voiced.sort(sortNicks);
        other.sort(sortNicks);
        return op.concat(voiced, other);
    };
});