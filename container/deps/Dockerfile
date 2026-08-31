# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library

# Start with R image as base image
FROM r-base:4.5.0 AS ppbase

ARG ARCH='x86_64'
ENV ARCH=$ARCH

ARG IMGREV=""
ARG IMGVER=""

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

RUN apt-get update && apt-get install --allow-downgrades -y \
    curl \
    wget \
    git \
    build-essential \
    librsvg2-dev \
	libbz2-dev \
	libcurl4-openssl-dev \
	libgsl0-dev \
	libhdf5-dev \
	hdf5-tools \
	# Runtime HDF5 for the rust binaries, which are compiled elsewhere (container/rust/Dockerfile)
	# and copied in by pack.sh. They link libhdf5_serial.so.310, but this image is based on r-base,
	# which tracks Debian sid/testing -- so libhdf5-dev above now resolves to HDF5 2.x and provides
	# only .320. Nothing then loads DEanalysis or dmrcate, and the failure surfaces as a dead child
	# process on a live request. The package name IS the soname, so this pins what actually matters.
	# The two versions co-install; -dev stays for anything needing headers. Must move in lockstep
	# with the HDF5 the rust builder compiles against (hdf5-metno 0.9 accepts only 1.x).
	libhdf5-310 \
	liblzma-dev \
    libdatrie1=0.2.14-2 \
	libncurses5-dev \
	libperl-dev \
	libssl-dev \
	zlib1g-dev \
    libcairo-dev \
	libjpeg-dev \
	libgif-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libpangocairo-1.0-0 \
	sqlite3 libsqlite3-dev \
	g++ \
    pkg-config \
    cmake \
    # r-base tracks debian testing/sid, so an unpinned python3 floats. it floated from
    # 3.13 to 3.14 and broke matplotlib's savefig at runtime (see python/requirements.txt),
    # after floating once before and breaking the hdf5 soname the rust binaries link against.
    # pinned so that drift fails the build here instead of surfacing in production.
    # python3-dev must match python3 exactly or apt refuses to resolve the pair.
    # these versions rotate out of the archive: when the build fails on a missing version,
    # read the new ones and re-pin, do NOT drop the pins --
    #   docker run --rm --platform linux/amd64 r-base:4.5.0 bash -c \
    #     'apt-get update -qq >/dev/null 2>&1; apt-cache policy python3 python3-dev python3-venv python3-pip'
    python3=3.14.6-1 \
    python3-dev=3.14.6-1 \
    python3-venv=3.14.6-1 \
    python3-pip=26.1.2+dfsg-1 \
    x11-common \
    libx11-dev \
    libx11-data \
    libxext-dev \
    libxmu-dev \
    libxt-dev \
    libreadline-dev \
    gfortran \
    software-properties-common \
    libargtable2-dev \
	## clean up
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/ \
  && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

ENV PATH="/opt/venv/bin:$PATH"

# Install R packages
COPY ./R/utils ./R/utils
RUN Rscript R/utils/install.pkgs.R

# Install NVM and Node.js
ENV NVM_DIR=/root/.nvm
ARG NODE_VERSION=24.10.0
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use $NODE_VERSION && \
    echo 'export NVM_DIR="$NVM_DIR"' >> /root/.bashrc && \
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> /root/.bashrc

ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin:$PATH"

# Verify node installation
RUN node -v && npm -v

# Install python dependencies
COPY ./python/requirements.txt ./python/requirements.txt
RUN python3 -m venv /opt/venv && \
    pip install --upgrade pip && \
    pip install -r ./python/requirements.txt && \
    ## clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/downloaded_packages/ /tmp/*.rds


RUN sed -i '/<blank>/,/<\/blank>/d' /etc/fonts/fonts.conf

ARG htsversion=1.14

RUN curl -L https://github.com/samtools/htslib/releases/download/${htsversion}/htslib-${htsversion}.tar.bz2 | tar xj && \
    (cd htslib-${htsversion} && ./configure --enable-plugins --with-plugin-path='$(libexecdir)/htslib:/usr/libexec/htslib' && make install) && \
    ldconfig
RUN curl -L https://github.com/samtools/samtools/releases/download/${htsversion}/samtools-${htsversion}.tar.bz2 | tar xj && \
    (cd samtools-${htsversion} && ./configure --with-htslib=system && make install)
RUN curl -L https://github.com/samtools/bcftools/releases/download/${htsversion}/bcftools-${htsversion}.tar.bz2 | tar xj && \
    (cd bcftools-${htsversion} && ./configure --enable-libgsl --with-htslib=system && make install)

RUN mkdir -p /home/root/pp && cd /home/root/pp && mkdir app && mkdir tp && mkdir cache && mkdir tools

RUN if [ "$ARCH" = "x86_64" ]; then \
        wget https://proteinpaint.stjude.org/ppdemo/tools/linux/straw -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedToBed -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedNamedItems -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedInfo -P /home/root/pp/tools/ && \
        wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/blat/gfClient -P /home/root/pp/tools/ && \
        chmod -R 755 /home/root/pp/tools; \
    else \
        echo "unknown ARCH='$ARCH'" && \
        exit 1; \
    fi

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

# The rust binaries are compiled in a different image (container/rust/Dockerfile, Debian trixie) and
# arrive here inside the npm package, so this is the first point where they meet the libraries they
# will actually run against. This image is based on r-base, which tracks Debian sid, so an apt bump
# can silently withdraw a soname they link -- exactly how a build once shipped binaries that could
# not load and 502'd every wilcoxon DE request. An unloadable binary must not reach a published
# image, so fail the build here rather than at request time.
#
# Note the equivalent check in rust/extract_binaries.sh only proves the BUILDER is self-consistent;
# because the builder deliberately does NOT share this base (hdf5-metno 0.9 cannot compile against
# the HDF5 2.x that r-base provides), this is the check that actually catches drift.
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

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

WORKDIR /home/root/pp/app
COPY --from=ppserverdeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./app-server.mjs ./
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-server.mjs && @sjcrh/proteinpaint-server"]
# CMD ["sleep", "3600"]

#################
# Full install
#################

# target for the full (backend + frontend) SJ package
FROM ppbase AS ppfulldeps

WORKDIR /home/root/pp

WORKDIR /home/root/pp/app
COPY --from=ppserver /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
ARG FRONTPKGVER
RUN npm install @sjcrh/proteinpaint-front@${FRONTPKGVER}

# enable ssh into this stage, for troubleshooting
CMD ["sleep", "3600"]

############
# Full app
############

# target for the full (backend + frontend) SJ app
FROM ppbase AS ppfull

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

WORKDIR /home/root/pp/app
COPY --from=ppfulldeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
# the build script/cmd must be called from the proteinpaint/container dir
COPY ./app-full.mjs ./
COPY public ./public
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-full.mjs && @sjcrh/proteinpaint-server"]
# CMD ["sleep", "3600"]
