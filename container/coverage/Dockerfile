# the same as NODE_IMAGE in server/Dockerfile, used only to copy npm into this image
ARG registry=docker.io/library
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315

FROM ${registry}/${NODE_IMAGE} AS node

#########################
# Server-only app update
#########################

FROM ppserver:latest

# The ppserver image runs as the unprivileged app user (UID 1000), but this image links packages into
# the root-owned npm global prefix under /usr/local, and only generates the combined coverage report,
# so it runs as root.
USER root

# the ppserver image is built on the runtime-only deps image, which has no npm,
# so copy npm from the official node image to install the dev deps and run the tests
COPY --from=node /usr/local/lib/node_modules/npm/ /usr/local/lib/node_modules/npm/
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    npm -v

WORKDIR /home/root/pp/app/
COPY ./python ./
RUN cd python && npm link

WORKDIR /home/root/pp/app/active

# the local ppserver:latest has the correct packed tgz entries 
# for updated workspace dependencies
RUN mkdir server && cp node_modules/@sjcrh/proteinpaint-server/package.json server/
WORKDIR /home/root/pp/app/active/server
# run npm install as early as possible, to cache/reuse as image layer;
# this install dev deps that are not in production image
RUN npm install

# copy other artifacts that are more prone to changes 
# and should not trigger unnecessary npm install
COPY ./server ./
RUN sed -i.bak "s|coverage.js & |coverage.js|g" package.json && npm link "@sjcrh/proteinpaint-python"

EXPOSE 3000
# sleep after the test run, so that the container
# does not crash while c8 is generating coverage report, and
# will give enough time for the scripts to copy the reports
# from the container to local host dir
CMD ["sh", "-c", "npm run combined:coverage; sleep 25; exit 0"]
# CMD ["sleep", "3600"]
