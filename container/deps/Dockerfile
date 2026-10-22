# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library

# The base images are Debian stable (trixie), which the Debian security team supports, and are pinned by digest,
# so that the cached lower layers stay valid between builds: a tag such as trixie-slim moves to a new digest every
# few weeks, which would invalidate every layer and rebuild R and python from scratch. The Debian security updates
# are applied on top of the cached layers instead, in the ppbase `apt-get upgrade` step. Bump the digests
# deliberately, which rebuilds every stage, see "Updating the base images" in deps/README.md.
ARG DEBIAN_IMAGE=debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315

# the node install is copied from the official image into ppbase, which must be on the same Debian release
FROM ${registry}/${NODE_IMAGE} AS node

##########
# OS libs
##########

# The system libraries and build toolchain that every other stage builds on. This is the slowest-changing layer,
# and is ordered first so that a change to the R, python, or node deps does not reinstall it.
FROM ${registry}/${DEBIAN_IMAGE} AS os

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    wget \
    git \
    build-essential \
	libbz2-dev \
	libcurl4-openssl-dev \
	libgsl-dev \
	libhdf5-dev \
	hdf5-tools \
	# Runtime HDF5 for the rust binaries, which are compiled in container/rust/Dockerfile and copied in by
	# pack.sh. That builder is also on trixie, so this is the same libhdf5_serial.so.310 that they link,
	# and is installed with libhdf5-dev anyway; it is listed so that a drift fails here, by name.
	libhdf5-310 \
	liblzma-dev \
	libncurses-dev \
	libperl-dev \
	libssl-dev \
	zlib1g-dev \
	libjpeg-dev \
	libgif-dev \
	# The headers of ragg, which R/src uses instead of png() to draw the plots without cairo or pango, and of its
	# systemfonts and textshaping deps, for when one of them is compiled from source instead of installed from a
	# P3M binary. R itself still pulls in the cairo and pango runtime libs: they are hard deps of r-base-core.
	libfontconfig-dev \
	libfreetype-dev \
	libfribidi-dev \
	libharfbuzz-dev \
	libpng-dev \
	libtiff-dev \
	libwebp-dev \
    fontconfig \
    fonts-dejavu-core \
    fonts-texgyre \
	sqlite3 libsqlite3-dev \
	g++ \
    pkg-config \
    cmake \
    # Debian stable does not move python3 to another minor version during a release, only to a patched
    # 3.13.x, so it is not pinned: a pin would fail the build at each Debian security update.
    python3 \
    python3-dev \
    python3-venv \
    python3-pip \
    # R from Debian stable, which the Debian security team supports, instead of from r-base, which tracks
    # Debian testing/sid. The R packages are installed in the rlib stage.
    r-base-core \
    r-base-dev \
    r-recommended \
    x11-common \
    libx11-dev \
    libx11-data \
    libxext-dev \
    libxmu-dev \
    libxt-dev \
    libreadline-dev \
    gfortran \
    libargtable2-dev \
	## clean up
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN sed -i '/<blank>/,/<\/blank>/d' /etc/fonts/fonts.conf

#############################
# Independently cached deps
#############################

# Each of the stages below only depends on the os stage, so BuildKit builds them in parallel, and a change to one,
# such as to python/requirements.txt, rebuilds only that stage. ppbase copies their outputs.

FROM os AS hts

ARG htsversion=1.24
WORKDIR /tmp/hts
# installed into / for the bcftools build, and into /staging for ppbase to copy; samtools, bgzip, and tabix are
# not installed, since the server reads bam and bgzipped, tabix-indexed files in process, see server/src/bamFile.ts
# and server/src/tabix.ts
RUN curl -fL https://github.com/samtools/htslib/releases/download/${htsversion}/htslib-${htsversion}.tar.bz2 | tar xj && \
    cd htslib-${htsversion} && \
    ./configure --enable-plugins --with-plugin-path='$(libexecdir)/htslib:/usr/libexec/htslib' && \
    make -j"$(nproc)" && make install && make install DESTDIR=/staging && \
    rm /staging/usr/local/bin/bgzip /staging/usr/local/share/man/man1/bgzip.1 \
        /staging/usr/local/bin/tabix /staging/usr/local/share/man/man1/tabix.1 && \
    ldconfig
RUN curl -fL https://github.com/samtools/bcftools/releases/download/${htsversion}/bcftools-${htsversion}.tar.bz2 | tar xj && \
    cd bcftools-${htsversion} && \
    ./configure --enable-libgsl --with-htslib=system && \
    make -j"$(nproc)" && make install DESTDIR=/staging

FROM os AS rlib

# The CRAN packages are installed from the Posit Package Manager binaries for trixie, instead of compiled from
# source, which was most of the build time before the base image was r-base. P3M serves the binaries only to a
# client that sends the R version and platform in its user agent. The Bioconductor packages are still compiled.
# This Rprofile.site change stays in this stage, since ppbase copies only the R library dirs.
ARG CRAN_REPO=https://p3m.dev/cran/__linux__/trixie/latest
ENV PP_CRAN_REPO=$CRAN_REPO
RUN echo 'options(repos = c(CRAN = Sys.getenv("PP_CRAN_REPO")), Ncpus = parallel::detectCores(), \
    HTTPUserAgent = sprintf("R/%s R (%s)", getRversion(), paste(getRversion(), R.version["platform"], R.version["arch"], R.version["os"])))' \
    >> /etc/R/Rprofile.site
COPY ./R/utils ./R/utils
RUN MAKEFLAGS="-j$(nproc)" Rscript R/utils/install.pkgs.R && \
    rm -rf /tmp/downloaded_packages/ /tmp/*.rds

FROM os AS py

COPY ./python/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

FROM os AS tools

ARG ARCH='x86_64'
RUN mkdir -p /home/root/pp/tools && \
    if [ "$ARCH" = "x86_64" ]; then \
        wget https://proteinpaint.stjude.org/ppdemo/tools/linux/straw -P /home/root/pp/tools/ && \
        wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedToBed -P /home/root/pp/tools/ && \
        wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedNamedItems -P /home/root/pp/tools/ && \
        wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedInfo -P /home/root/pp/tools/ && \
        wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/blat/gfClient -P /home/root/pp/tools/ && \
        chmod -R 755 /home/root/pp/tools; \
    else \
        echo "unknown ARCH='$ARCH'" && \
        exit 1; \
    fi

#########
# ppbase
#########

FROM os AS ppbase

ARG ARCH='x86_64'
ENV ARCH=$ARCH

# ordered from the least to the most often changed, since a changed COPY invalidates the cache of the later steps
COPY --from=hts /staging/usr/local/ /usr/local/
# update.packages() in install.pkgs.R may update the r-recommended packages in /usr/lib/R/library
COPY --from=rlib /usr/lib/R/library/ /usr/lib/R/library/
COPY --from=rlib /usr/local/lib/R/site-library/ /usr/local/lib/R/site-library/
COPY --from=tools /home/root/pp/tools/ /home/root/pp/tools/
# the official node image files are owned by root; the headers are for a native addon build by node-gyp
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
COPY --from=node /usr/local/include/node/ /usr/local/include/node/
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack && \
    ldconfig && \
    node -v && npm -v
COPY --from=py /opt/venv/ /opt/venv/
ENV PATH="/opt/venv/bin:$PATH"

RUN mkdir -p /home/root/pp/app /home/root/pp/tp /home/root/pp/cache

# The app runs as an unprivileged user 'app', with UID/GID 1000. The UID must stay 1000: container/run.sh maps
# the rootless podman host account to it, and check_base_user.sh expects a non-root user in the published
# ppserver/ppfull images.
#
# Another UID may also run the image, such as to match the owner of the bind-mounted files, with
# `docker run --user <uid>:0` or a Kubernetes runAsUser with runAsGroup 0: a runtime assigns group 0 to
# a UID that has no account in the image, so the dirs that the app writes at runtime are also owned by,
# and writable for, group 0, or else writable for any UID, like the cache dir below. The app files under /home/root/pp/app/active are owned by root and are not
# written at runtime, see the ppserver and ppfull stages.
#
# The cache dir is owned by root with mode 1733, so that the app user, or another UID, may create and use a subdir
# with a known name, but may not list the entries, change the mode, or rename or remove the entries of another user:
# the server uses a subdir whose name is derived from a key, see hideCachedir in server/src/serverconfig.js.
# A new mounted cache dir needs the same owner and mode on the host. For an existing mount, keep it listable for
# the first upgraded start so legacy entries can be migrated, then apply this owner and mode.
RUN groupadd -g 1000 app && \
    useradd -m -u 1000 -g app -d /home/app -s /bin/bash app && \
    chown root:0 /home/root/pp/cache && \
    chmod 1733 /home/root/pp/cache && \
    chgrp -R 0 /home/app && \
    chmod -R g=u /home/app

# The Debian security updates since the pinned base image, applied on top of the cached layers so that they do not
# require rebuilding R or python. build.sh sets OS_UPDATES to the current date, so this step runs at most once a day;
# a stable-release update keeps the library ABIs, which the compiled R and python packages link against.
ARG OS_UPDATES=""
RUN echo "OS_UPDATES=$OS_UPDATES" && \
    apt-get update && apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# the R packages must load against the libraries in this image, after the updates above
COPY ./R/utils ./R/utils
RUN Rscript R/utils/validate.pkgs.R

# the interpreter and tool dirs are installed by root and are only read by the app user
RUN for d in /opt/venv /opt/venv/lib/python3*/site-packages /usr/local/lib/R/site-library /usr/lib/R/site-library \
        /usr/lib/R/library /usr/local/bin /usr/local/lib/node_modules /home/root/pp/tools; do \
        if [ -e "$d" ] && su -s /bin/sh app -c "test -w '$d'"; then echo "ERROR: $d is writable by the app user"; exit 1; fi; \
    done

# Declared after all the dependency install steps: a changed ARG value invalidates the cache of every
# later RUN step in the stage, and IMGREV changes with every commit.
ARG IMGREV=""
ARG IMGVER=""
LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

#####################
# Server-only install
######################

# target for the backend-only SJ package
FROM ppbase AS ppserverdeps

WORKDIR /home/root/pp
COPY ./tmppack ./tmppack
WORKDIR /home/root/pp/app 
RUN mkdir active
# !!! NOTE: after open-sourcing, will only need the @sjcrh registry URL, no token required !!!
WORKDIR /home/root/pp/app/active

ARG SERVERPKGVER
RUN if [ -f /home/root/pp/tmppack/sjcrh-proteinpaint-server-${SERVERPKGVER}.tgz ]; then \
      npm install /home/root/pp/tmppack/sjcrh-proteinpaint-server-${SERVERPKGVER}.tgz; \
    else \
      npm install @sjcrh/proteinpaint-server@${SERVERPKGVER}; \
    fi
# a tar extraction run by root, such as for the rust binaries in the proteinpaint-rust postinstall, keeps the file owner
# and modes from the archive, which are changed to root and go-w
RUN find . \( ! -user 0 -o ! -group 0 \) -exec chown -h 0:0 {} + && \
    find . ! -type l -perm /022 -exec chmod go-w {} +

# The rust binaries are compiled in a different image (container/rust/Dockerfile, Debian trixie) and
# arrive here inside the npm package, so this is the first point where they meet the libraries they
# will actually run against. Both images are now on trixie, but they are built and pinned separately,
# and a build once shipped binaries that could not load and 502'd every wilcoxon DE request, when this
# image was on a base that tracked Debian sid. An unloadable binary must not reach a published image,
# so fail the build here rather than at request time.
#
# Note the equivalent check in rust/extract_binaries.sh only proves the BUILDER is self-consistent;
# this is the check that catches a drift between the builder and this image.
RUN bindir=node_modules/@sjcrh/proteinpaint-rust/target/release; \
    if [ ! -d "$bindir" ]; then \
      echo "WARNING: $bindir not found, skipping shared library check" >&2; \
    else \
      unresolved=0; \
      for bin in "$bindir"/*; do \
        [ -f "$bin" ] && [ -x "$bin" ] || continue; \
        if ldd "$bin" 2>/dev/null | grep -q "not found"; then \
          echo "ERROR: $bin cannot resolve:" >&2; \
          ldd "$bin" 2>/dev/null | grep "not found" >&2; \
          unresolved=1; \
        fi; \
      done; \
      if [ "$unresolved" -ne 0 ]; then \
        echo "unloadable rust binaries: this image lacks a shared library they were linked against" >&2; \
        exit 1; \
      fi; \
      echo "all rust binaries resolve their shared libraries"; \
    fi

# enable ssh into this stage, for troubleshooting
CMD ["sh", "-c", "node app-server.mjs"]

#####################
# Server-only app
######################

# target for the backend-only SJ server app
FROM ppbase AS ppserver

ARG IMGREV=""
ARG IMGVER=""
LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

# the app files are owned by root, which installed them, and are only read by the app user
WORKDIR /home/root/pp/app
COPY --from=ppserverdeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./app-server.mjs ./
# Nothing under the app dir is written at runtime: fail the build for an app file that the app user, or another UID
# with group 0, can write. A mount under this dir, such as for dataset/, is set by the container runtime.
RUN if find . ! -type l \( ! -user 0 -o -perm /022 \) | grep .; then \
      echo "ERROR: the app files above are not owned by root, or are writable by group or others"; exit 1; \
    fi; \
    if su -s /bin/sh app -c "find /home/root/pp/app/active -writable" | grep .; then \
      echo "ERROR: the app files above are writable by the app user"; exit 1; \
    fi
# the HOME of another UID, which has no account in the image
ENV HOME=/home/app
USER app
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-server.mjs && @sjcrh/proteinpaint-server"]
# CMD ["sleep", "3600"]

#################
# Full install
#################

# target for the full (backend + frontend) SJ package
FROM ppbase AS ppfulldeps

WORKDIR /home/root/pp
COPY ./tmppack ./tmppack

WORKDIR /home/root/pp/app
COPY --from=ppserver /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
ARG FRONTPKGVER
RUN if [ -f /home/root/pp/tmppack/sjcrh-proteinpaint-front-${FRONTPKGVER}.tgz ]; then \
      npm install /home/root/pp/tmppack/sjcrh-proteinpaint-front-${FRONTPKGVER}.tgz; \
    else \
      npm install @sjcrh/proteinpaint-front@${FRONTPKGVER}; \
    fi
# a tar extraction run by root, such as for the rust binaries in the proteinpaint-rust postinstall, keeps the file owner
# and modes from the archive, which are changed to root and go-w
RUN find . \( ! -user 0 -o ! -group 0 \) -exec chown -h 0:0 {} + && \
    find . ! -type l -perm /022 -exec chmod go-w {} +

# enable ssh into this stage, for troubleshooting
CMD ["sleep", "3600"]

############
# Full app
############

# target for the full (backend + frontend) SJ app
FROM ppbase AS ppfull

ARG IMGREV=""
ARG IMGVER=""
LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

# the app files are owned by root, which installed them, and are only read by the app user
WORKDIR /home/root/pp/app
COPY --from=ppfulldeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./app-full.mjs ./
COPY public ./public
# the client bundle in bin/ and the public/cards are generated at build time, so that app-full.mjs reuses them
# at startup instead of writing them; tar run by root keeps the file owner and modes from the bundle archive,
# which are changed to root and go-w
RUN node node_modules/@sjcrh/proteinpaint-front/init.js && \
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
# the HOME of another UID, which has no account in the image
ENV HOME=/home/app
USER app
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-full.mjs && @sjcrh/proteinpaint-server"]
# CMD ["sleep", "3600"]
