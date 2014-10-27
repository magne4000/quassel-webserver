# quassel-webserver

:warning: Alpha version

:warning: Your node version should be at least v0.11.13

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

and run the following command: `PORT=64004 node app.js`

The server is now running.

### In the browser
Just go to http://yourserver:64004 and enter your quasselcore informations and credentials

#### Query String Arguments
You can add arguments onto the url to automatically populate the login form. By filling out all 4 arguments, the client will automatically login.

* `host` QuasselCore host
* `port` QuasselCore port
* `user` Your QuasselCore username
* `password` Your QuasselCore password (Using this argument isn't advised)

**Example:** http://yourserver:64004/?host=localhost&port=4242&user=AdminUser

## License
Copyright (c) 2014 Joël Charles  
Licensed under the MIT license.
