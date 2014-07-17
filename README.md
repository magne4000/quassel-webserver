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

## License
Copyright (c) 2014 Joël Charles  
Licensed under the MIT license.
