module.exports = {
    default: {  // Those can be overhidden in the browser
        host: '',  // quasselcore host
        port: 4242,  // quasselcore port
        initialBacklogLimit: 20,  // Amount of backlogs to fetch per buffer on connection
        backlogLimit: 100,  // Amount of backlogs to fetch per buffer after first retrieval
        securecore: true,  // Connect to the core using SSL
        theme: 'default',  // Default UI theme,
        perchathistory: true,  // Separate history per buffer
        displayfullhostmask: false,  // Display full hostmask instead of just nicks in messages
        emptybufferonswitch: false,  // Trim buffer when switching to another buffer. Can be `false` or a positive integer
        highlightmode: 2  // Highlight mode: 1: None, 2: Current nick, 3: All nicks from identity
    },
    webserver: {
        socket: false,  // Tells the webserver to listen for connections on a local socket. This should be a path. Can be overhidden by '--socket' argument
        listen: null,  // Address on which to listen for connection, defaults to listening on all available IPs. Can be overhidden by '--listen' argument
        port: null,  // Port on which to listen for connection, defaults to 64080 for http mode, 64443 for https. Can be overhidden by '--port' argument
        mode: null  // can be 'http' or 'https', defaults to 'https'. Can be overhidden by '--mode' argument
    },
    themes: ['default', 'darksolarized'],  // Available themes
    forcedefault: false,  // Will force default host and port to be used, and will hide the corresponding fields in the UI
    prefixpath: ''  // Configure this if you use a reverse proxy
};
