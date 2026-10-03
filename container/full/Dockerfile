# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library
ARG VERSION=2.215.0

#########################
# Full app update
#########################

FROM ghcr.io/stjude/ppfull:$VERSION

ARG IMGREV=""
ARG IMGVER=""
LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

# the app files are installed by root and are only read by the app user (UID 1000, see deps/Dockerfile),
# which the base image runs as; build2.sh verifies that with check_base_user.sh
USER root

WORKDIR /home/root/pp
COPY ./tmppack ./tmppack
WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./full/package.json  ./
# A temporary npm cache, instead of one under HOME. npm run by root gives the installed files the owner of this dir,
# so it is changed to root first. The files from an older base image, which the app user owns, are also changed;
# that copies them into this layer, but finds no file to change in a base image whose app files root owns.
RUN chown 0:0 . && \
    npm install --omit=dev --cache=/tmp/npm-cache && rm -rf /tmp/npm-cache && \
    find . \( ! -user 0 -o ! -group 0 \) -exec chown -h 0:0 {} + && \
    find . ! -type l -perm /022 -exec chmod go-w {} +
COPY ./full/app-full.mjs ./envHelpers.mjs ./runtimePosture.mjs ./
COPY ./public ./public
# The client bundle in bin/ and the public/cards are generated at build time, so that app-full.mjs reuses them at
# startup instead of writing them. Any bin/ and cards from the base image are for its older front package version.
# tar run by root keeps the file owner and modes from the bundle archive, which are changed to root and go-w.
RUN rm -rf bin public/cards && \
    node node_modules/@sjcrh/proteinpaint-front/init.js && \
    test -f bin/.pp-bundle-ready && \
    find bin public \( ! -user 0 -o ! -group 0 \) -exec chown -h 0:0 {} + && \
    find bin public ! -type l -perm /022 -exec chmod go-w {} +

# Nothing under the app dir is written at runtime: fail the build for an app file that the app user, or another UID
# with group 0, can write. A mount under this dir, such as for dataset/ or public/, is set by the container runtime;
# front/init.js may then add the missing index.html and cards to a mounted public/ at startup.
RUN if find . ! -type l \( ! -user 0 -o -perm /022 \) | grep .; then \
      echo "ERROR: the app files above are not owned by root, or are writable by group or others"; exit 1; \
    fi; \
    if su -s /bin/sh app -c "find /home/root/pp/app/active -writable" | grep .; then \
      echo "ERROR: the app files above are writable by the app user"; exit 1; \
    fi

# numeric ids, the same as in the base image
USER 1000:1000

EXPOSE 3000
# default to the container paths and port in server/src/serverconfig.js and envHelpers.mjs,
# may be overridden at runtime, such as `docker run -e PP_MODE= ...` to use the serverconfig.json paths and port
ENV PP_MODE=container-prod
# envHelpers.mjs adds the node --permission and --allow-* flags,
# to limit the server process file access, passes any <NAME>_CREDS_FILE content as <NAME>_CREDS, and then
# replaces itself with the server process
CMD ["node", "envHelpers.mjs", "node", "--enable-source-maps", "app-full.mjs"]
# CMD ["sleep", "3600"]