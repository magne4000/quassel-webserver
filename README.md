# quassel-webserver

:warning: Alpha version
:warning: Your node (NOT quassel core) version should be at least v0.11.13. (To install node, you can run `npm -g install n` and `n latest`.)

A web client for Quassel (requires a running quasselcore)

![Webmusic screenshot](https://github.com/magne4000/magne4000.github.com/raw/master/images/quasselwebapp.png)

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

####
File `settings.js` can be modified to specify default quasselcore `host` and `port`.
If `forcedefault` is set to `true`, `host` and `port` will not be editable on client side.

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

#### Query String Arguments
You can add arguments onto the url to automatically populate the login form. By filling out all 4 arguments, the client will automatically login.

* `host` QuasselCore host
* `port` QuasselCore port
* `user` Your QuasselCore username
* `password` Your QuasselCore password (Using this argument isn't advised)

**Example:** https://yourserver:64443/?host=localhost&port=4242&user=AdminUser

## License
Copyright (c) 2014 Joël Charles  
Licensed under the MIT license.
