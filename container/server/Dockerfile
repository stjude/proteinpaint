# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library
ARG VERSION=2.118.2-0

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

# Copy package.json first before npm commands
COPY ./server/package.json ./

# Only now it's safe to run npm install
RUN npm install

# Copy the rest of the server files
COPY ./server/app-server.mjs ./

EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-server.mjs"]