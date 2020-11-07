## Deployment

Use the Nginx proxy with LetsEncrypt sidecar from [here](https://github.com/jwulf/letsencrypt-nginx-sidecar).

Copy this file to the root of the project, create a `config.json`, and use: 

```
docker-compose up -d
```

## Build your own Docker image 

Run this command in the root of the project:

```
docker build -t sitapati/slack-archivist .
```

