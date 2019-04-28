const WebSocket = require('ws');
const net = require('net');


function createSocket(host, port, callback) {
    var socket = net.connect({
        host: host,
        port: port
    }, function (err) {
        if (err) return callback(err);
    });
    
    socket.on('error', function (err) {
        callback(err);
    });
    
    return socket;
}

module.exports = function(server, settings) {
    const wss = new WebSocket.Server({
        server: server
    });
    
    wss.on('connection', function connection(ws, req) {
        ws.once('message', function incoming(targetInfo) {
            // First message is the information about the target server
            var { server, port } = JSON.parse(targetInfo);
            
            if (settings.val.forcedefault) {
                server = settings.val.default.host;
                port = settings.val.default.port;
            }
            
            const socket = createSocket(server, port, (err) => {
                if (err) return ws.send(err.toString());
            });
            
            ws.on('message', function (data) {
                socket.write(data, 'binary', function () {
                    // console.log('Sent: ', (flags.buffer || chunk).toString());
                });
            });
            socket.on('data', function (chunk) {
                // console.log('Received: ', chunk.toString());
                // Providing a callback is important, otherwise errors can be thrown
                ws.send(chunk, { binary: true }, (err) => err && console.error(err));
            });
            socket.on('end', function () {
                console.log('TCP connection closed by remote');
                ws.close();
            });
            ws.on('close', function () {
                console.log('Websocket connection closed');
                socket.end();
            });
        });
    });
};
