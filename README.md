# quassel-webserver
A web client for Quassel (requires a running quasselcore)

:exclamation: Your node (NOT quasselcore) version should be at least v0.11.13 (**v0.12.x** recommended).
To install node last version, you can run :
```
npm -g install n
n latest
```

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
If `forcedefault` is set to `true`, `host` and `port` will not be editable on client side.  
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

### Init script
You can use a startup script to the app at system startup.
```
cp scripts/startup /etc/init.d/quasselweb
```
and then edit the file /etc/init.d/quasselweb and change `BASEDIR`, `RUNASUSER` and `RUNASGROUP` vars.

### Reverse proxy snippets
#### nginx
```nginx
# rewrite ^[/]quassel$ /quassel/ permanent;
location /quassel {
    proxy_pass http://127.0.0.1:64080/quassel;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_redirect off;
}
```

## License
Copyright (c) 2014-2015 Joël Charles  
Licensed under the MIT license.
