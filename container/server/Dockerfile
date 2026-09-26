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

# the base image runs as the unprivileged app user (UID 1000, see deps/Dockerfile),
# which build2.sh verifies with check_base_user.sh; numeric ids are used so that
# a build against an older root-based image fails on that check, not on a missing user
USER 1000:1000

WORKDIR /home/root/pp
COPY ./tmppack ./tmppack
WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY --chown=1000:1000 ./server/package.json  ./
RUN npm install --omit=dev --cache=/home/app/.npm
COPY --chown=1000:1000 ./server/app-server.mjs ./envHelpers.mjs ./

EXPOSE 3000
# default to the container paths and port in server/src/serverconfig.js and envHelpers.mjs,
# may be overridden at runtime, such as `docker run -e PP_MODE= ...` to use the serverconfig.json paths and port
ENV PP_MODE=container-prod
# envHelpers.mjs generates node.config.json and adds --experimental-default-config-file to apply it,
# to limit the server process file access, and passes any <NAME>_CREDS_FILE content as a <NAME>_CREDS env variable
CMD ["node", "envHelpers.mjs", "node", "--enable-source-maps", "app-server.mjs"]
# CMD ["sleep", "3600"]
