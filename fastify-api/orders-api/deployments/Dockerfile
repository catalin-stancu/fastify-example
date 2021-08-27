# Build checks https://docs.docker.com/language/nodejs/run-tests/
# Add layers using RUN and COPY in order of likelyhood of changing

## Build temporary helper image
FROM node:14.15.0-alpine as base
ARG HOME

RUN mkdir /app
WORKDIR /app
# install dependencies
RUN apk update && apk upgrade && apk add --no-cache make openssl openssh-client ca-certificates git mercurial

# configure ssh
COPY deployments/id_rsa /root/.ssh/
COPY deployments/id_rsa.pub /root/.ssh/

ADD deployments/config /root/.ssh
RUN ssh-keyscan bitbucket.org > /root/.ssh/known_hosts
RUN chmod -R 600 /root/.ssh
RUN git config --global url."git@bitbucket.org:".insteadOf "https://bitbucket.org/"
# Copy everything except what is excluded by .dockergignore
# We need to do this because otherwise the whole directory is
# sent to the Docker Daemon as the build context which takes 
# a lot of time
COPY . .

# Remove node_modules and package-lock and do a fresh install
RUN rm -rf node_modules/ package-lock.json
RUN npm i

### Use a multi-stage build to run tests and checks before final build
#FROM base as test
## RUN npm ci # Normally you would use this but there are problems with npm installation of git URLS by npm (for the fastify-global-plugin shared repo)
#COPY --from=base . .
## Apply migrations

## Run checks before building production image
#RUN npm run test
#RUN npm run check:deps
#RUN npm run check:cyclic-deps


## Build production/stage image
FROM base as prod
# RUN npm ci --only=production --ignore-scripts # Normally you would use this but there are problems with npm installation of git URLS by npm (for the fastify-global-plugin shared repo)
COPY --from=base . .
WORKDIR /app
CMD npm run migrate:create-db; npm run migrate:up; npm run start:prod:consumers