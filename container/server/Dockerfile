# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library
ARG VERSION=2.29.5

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
RUN cp -r ~/.npm /home/root/ && npm i --package-lock-only
COPY ./server/package.json  ./
RUN npm install --omit=dev --prefer-offline
COPY ./server/app-server.js  ./

EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-server.js"]
# CMD ["sleep", "3600"]
