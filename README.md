# quassel-webserver

:warning: Your node (NOT quassel core) version should be at least v0.11.13. (To install node, you can run `npm -g install n` and `n latest`.)

:warning: Node v0.12 is now stable, so of course you can use it !

A web client for Quassel (requires a running quasselcore)

### Screenshots

#### Default
![default theme](https://github.com/magne4000/magne4000.github.com/raw/master/images/quassel-default-1.png)

#### Solarized
![solarized theme](https://github.com/magne4000/magne4000.github.com/raw/master/images/quassel-solarized-1.png)

### On the server
Install the server with: 
```
git clone https://github.com/magne4000/quassel-webserver.git
cd quassel-webserver
npm install --production
```
or to update `git pull && npm update`

and run the following command: `node app.js`

The server is now running.

#### Settings
It is recommended to copy settings.js file to a new settings-user.js file
```
cp settings.js settings-user.js
```
File `settings-user.js` can then be modified to specify default quasselcore `host` and `port`.  
If `forcedefault` is set to `true`, `host`, `port` (and `user` if it is set) will not be editable on client side. If `password` is also set, the client will automatically login when the page loads.  
If `prefixpath` is not empty, the webserver will not be accessible at https://server:64443/ but at https://server:64443`prefixpath`/;  
`initialBacklogLimit` defines the number of messages that will de retrieved for each buffer on connection.  
`backlogLimit` defines the number of messages that will be retrieved for a buffer on each request to fetch additional backlogs.  

### Usage
See the output of the command `node app.js --help`

### In the browser
Just go to https://yourserver:64443 and enter your quasselcore informations and credentials

### Certificate
You can use your own certificate for HTTPS mode. The key file is located at ssl/key.pem, and the certificate ssl/cert.pem.

You can generate a new self signed certificate with the following command:
```
openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -nodes
```
#### Init script
You can use a startup script to the app at system startup.
```
cp scripts/startup /etc/init.d/quasselweb
```
and then edit the file /etc/init.d/quasselweb and change `BASEDIR`, `RUNASUSER` and `RUNASGROUP` vars.

## License
Copyright (c) 2014-2015 Joël Charles  
Licensed under the MIT license.
