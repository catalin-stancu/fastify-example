# Build checks https://docs.docker.com/language/nodejs/run-tests/
# Add layers using RUN and COPY in order of likelyhood of changing

## Build temporary helper image
FROM node:14.15.0-alpine as base
ARG HOME

RUN mkdir /app
WORKDIR /app

# Copy everything except what is excluded by .dockergignore
# We need to do this because otherwise the whole directory is
# sent to the Docker Daemon as the build context which takes 
# a lot of time
COPY . .


## Use a multi-stage build to run tests and checks before final build
FROM base as test
# RUN npm ci # Normally you would use this but there are problems with npm installation of git URLS by npm (for the fastify-global-plugin shared repo)
COPY --from=base . .
# Apply migrations
RUN npm run migrate:create-db
RUN npm run migrate:up
# Run checks before building production image
RUN npm run test
RUN npm run check:deps
RUN npm run check:cyclic-deps


## Build production/stage image
FROM base as prod
# RUN npm ci --only=production --ignore-scripts # Normally you would use this but there are problems with npm installation of git URLS by npm (for the fastify-global-plugin shared repo)
COPY --from=base . .
CMD ["npm", "run", "start:prod"]