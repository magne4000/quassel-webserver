module.exports = {
    default: {
        host: '',  // quasselcore host
        port: 4242,  // quasselcore port
        initialBacklogLimit: 20,  // Amount of backlogs to fetch per buffer on connection
        backlogLimit: 100,  // Amount of backlogs to fetch per buffer after first retrieval
        securecore: true,  // Connect to the core using SSL
        theme: 'default'  // Default UI theme
    },
    themes: ['default', 'darksolarized'],  //  Available themes
    forcedefault: false,  // Will force default host and port to be used, and will hide the corresponding fields in the UI
    prefixpath: ''  // Configure this if you use a reverse proxy
};
