#!/bin/bash

docker build -t sitapati/slack-archivist .
docker-compose -f deploy/docker-compose.yml down
docker-compose -f deploy/docker-compose.yml up -d
COMPOSE_HTTP_TIMEOUT=120 docker-compose --verbose -f deploy/docker-compose.yml logs -f