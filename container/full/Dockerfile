# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library
ARG VERSION=2.224.1
# the published, app-free deps image of VERSION, or another one such as a local arm64 image, see build2.sh -a and -i;
# not ppfull, which already has an app installed, so that this build does not ship its app layer twice
ARG BASE_IMAGE=ghcr.io/stjude/ppdepsruntime:$VERSION
# the same as NODE_IMAGE in deps/Dockerfile, whose node install is in the base image
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315

#########################
# Full app install
#########################

# The app is installed with npm in this stage, since the base image has no npm. The node native addons are
# prebuilt binaries, which bundle the libraries that they load, and are checked against the base image below.
FROM ${registry}/${NODE_IMAGE} AS install

WORKDIR /home/root/pp
COPY ./tmppack ./tmppack
WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./full/package.json  ./
# a temporary npm cache, instead of one under HOME; a tar extraction run by root, such as for the rust binaries in the
# proteinpaint-rust postinstall, keeps the file owner and modes from the archive, which are changed to root and go-w
RUN npm install --omit=dev --cache=/tmp/npm-cache && rm -rf /tmp/npm-cache && \
    find . \( ! -user 0 -o ! -group 0 \) -exec chown -h 0:0 {} + && \
    find . ! -type l -perm /022 -exec chmod go-w {} +
# The rust postinstall does not fail the npm install when it cannot download or compile the binaries,
# such as from a draft GitHub release, so fail the build here instead of at server startup.
RUN if [ -z "$(ls node_modules/@sjcrh/proteinpaint-rust/target/release 2>/dev/null)" ]; then \
      echo "ERROR: missing the rust binaries in node_modules/@sjcrh/proteinpaint-rust/target/release"; exit 1; \
    fi

#########################
# Full app update
#########################

FROM $BASE_IMAGE

ARG IMGREV=""
ARG IMGVER=""
LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

# the app files are installed by root and are only read by the app user (UID 1000, see deps/Dockerfile),
# which the base image runs as; build2.sh verifies that with check_base_user.sh
USER root

# replaces the app files of the base image, so that no file of its older app or front package version is left,
# such as in bin/ and public/cards
RUN rm -rf /home/root/pp/app/active
COPY --from=install /home/root/pp/app/active /home/root/pp/app/active
WORKDIR /home/root/pp/app/active
COPY ./full/app-full.mjs ./envHelpers.mjs ./runtimePosture.mjs ./
COPY ./public ./public
# The client bundle in bin/ and the public/cards are generated at build time, so that app-full.mjs reuses them at
# startup instead of writing them. init.js keeps an existing public/cards, such as one that a local container/public
# has from an earlier run and that the COPY above adds, so it is removed first to use the cards of the installed
# front package. tar run by root keeps the file owner and modes from the bundle archive, which are changed to root
# and go-w.
RUN rm -rf public/cards && \
    node node_modules/@sjcrh/proteinpaint-front/init.js && \
    test -f bin/.pp-bundle-ready && \
    find bin public \( ! -user 0 -o ! -group 0 \) -exec chown -h 0:0 {} + && \
    find bin public ! -type l -perm /022 -exec chmod go-w {} +

# the rust binaries and the node native addons must load against the libraries and the node version of the base image
RUN --mount=type=bind,source=deps/checkSharedLibs.sh,target=/tmp/checkSharedLibs.sh sh /tmp/checkSharedLibs.sh node_modules && \
    node -e "new (require('better-sqlite3'))(':memory:').close(); require('skia-canvas')"

# The cache dir is owned by root with mode 1733, the same as in deps/Dockerfile, so that the app user may create and use
# a subdir with a known name but may not list the entries, see hideCachedir in server/src/serverconfig.js. Also set
# here, so that it applies with a base image from before that deps/Dockerfile change. A mounted cache dir needs the
# same owner and mode on the host.
RUN chown root:0 /home/root/pp/cache && chmod 1733 /home/root/pp/cache

# remove the files that the app does not use, see removeTools.sh
RUN --mount=type=bind,source=removeTools.sh,target=/tmp/removeTools.sh sh /tmp/removeTools.sh

# Nothing under the app dir is written at runtime: fail the build for an app file that the app user, or another UID
# with group 0, can write. A mount under this dir, such as for dataset/ or public/, is set by the container runtime;
# front/init.js may then add the missing index.html and cards to a mounted public/ at startup.
RUN if find . ! -type l \( ! -user 0 -o -perm /022 \) | grep .; then \
      echo "ERROR: the app files above are not owned by root, or are writable by group or others"; exit 1; \
    fi

# numeric ids, the same as in the base image
USER 1000:1000
RUN if find /home/root/pp/app/active -writable | grep .; then \
      echo "ERROR: the app files above are writable by the app user"; exit 1; \
    fi

EXPOSE 3000
# default to the container paths and port in server/src/serverconfig.js and envHelpers.mjs,
# may be overridden at runtime, such as `docker run -e PP_MODE= ...` to use the serverconfig.json paths and port
ENV PP_MODE=container-prod
# envHelpers.mjs adds the node --permission and --allow-* flags,
# to limit the server process file access, passes any <NAME>_CREDS_FILE content as <NAME>_CREDS, and then
# replaces itself with the server process
CMD ["node", "envHelpers.mjs", "node", "--enable-source-maps", "app-full.mjs"]
# CMD ["sleep", "3600"]
