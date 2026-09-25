# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library
ARG VERSION=2.206.1

#########################
# Server-only app update
#########################

FROM ghcr.io/stjude/ppserver:$VERSION

ARG IMGREV=""
ARG IMGVER=""
LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

WORKDIR /home/root/pp
COPY ./tmppack ./tmppack
WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./server/package.json  ./
RUN npm install --omit=dev --cache=/root/.npm
COPY ./server/app-server.mjs  ./
COPY ./envHelpers.mjs ./

EXPOSE 3000
# envHelpers.mjs generates node.config.json and adds --experimental-default-config-file to apply it,
# to limit the server process file access, and passes any <NAME>_CREDS_FILE content as a <NAME>_CREDS env variable
CMD ["node", "envHelpers.mjs", "node", "--enable-source-maps", "app-server.mjs"]
# CMD ["sleep", "3600"]
