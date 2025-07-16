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
	liblzma-dev \
        libdatrie1=0.2.13-3+b1 \
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
    python3 \
    python3-venv \
    python3-pip \
#    In case the python3 pin breaks the build use:
#    python3-pip \
#    python3-venv \
#    and read the versions and pin again.
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
ARG NODE_VERSION=22.15.0
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
RUN python3 -m venv /opt/venv && \
    pip install --upgrade pip && \
    pip install blitzgsea==1.3.47 matplotlib nibabel numpy numba xlsxwriter  pre-commit && \
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
        wget -O /usr/local/bin/clustalo http://www.clustal.org/omega/clustalo-1.2.4-Ubuntu-x86_64 && chmod 755 /usr/local/bin/clustalo && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigWigSummary -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedToBed -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedNamedItems -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedInfo -P /home/root/pp/tools/ && \
        wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/blat/gfClient -P /home/root/pp/tools/ && \
        chmod -R 755 /home/root/pp/tools; \
    elif [ "$ARCH" = "aarch64" ]; then \
        curl http://www.clustal.org/omega/clustal-omega-1.2.4.tar.gz -O && tar -xvf clustal-omega-1.2.4.tar.gz && \
        cd clustal-omega-1.2.4 && ./configure --prefix="/usr/local" --build=${ARCH}-unknown-linux-gnu && make && make install && \
        chmod 755 /usr/local/bin/clustalo; \
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
