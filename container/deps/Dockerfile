# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library

# need to manually bump the base version periodically
FROM ${registry}/node:20-bookworm-slim AS ppbase
ARG ARCH='x86_64'
ENV ARCH=$ARCH

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    librsvg2-dev \
	libbz2-dev \
	libcurl4-openssl-dev \
	libgsl0-dev \
	liblzma-dev \
	libncurses5-dev \
	libperl-dev \
	libssl-dev \
	zlib1g-dev \
    libcairo-dev \
	libjpeg-dev \
	libgif-dev \
	sqlite3 libsqlite3-dev \
	g++ \
    pkg-config \
    cmake \
	## clean up
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/ \
  && rm -rf /tmp/downloaded_packages/ /tmp/*.rds


RUN sed -i '/<blank>/,/<\/blank>/d' /etc/fonts/fonts.conf

ARG htsversion=1.14

RUN curl -L https://github.com/samtools/htslib/releases/download/${htsversion}/htslib-${htsversion}.tar.bz2 | tar xj && \
    (cd htslib-${htsversion} && ./configure --enable-plugins --with-plugin-path='$(libexecdir)/htslib:/usr/libexec/htslib' && make install) && \
    ldconfig 
RUN curl -L https://github.com/samtools/samtools/releases/download/${htsversion}/samtools-${htsversion}.tar.bz2 | tar xj && \
    (cd samtools-${htsversion} && ./configure --with-htslib=system && make install) 
RUN curl -L https://github.com/samtools/bcftools/releases/download/${htsversion}/bcftools-${htsversion}.tar.bz2 | tar xj && \
    (cd bcftools-${htsversion} && ./configure --enable-libgsl --with-htslib=system && make install)

RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 'B8F25A8A73EACF41' && `#pragma: allowlist secret` \
    echo "deb http://cloud.r-project.org/bin/linux/debian bookworm-cran40/" >> /etc/apt/sources.list \ 
    && apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key 'E19F5F87128899B192B1A2C2AD5F960A256A04AF' #pragma: allowlist secret

RUN apt-get update && apt-get install -y r-base -y r-base-dev -y libargtable2-dev \
	## install R packages
 	&& R -e "install.packages(c('cmprsk', 'hwde', 'jsonlite', 'survival', 'lmtest', 'dplyr', 'tidyr', 'BiocManager', 'readr'), dependencies=TRUE, repos='http://cran.rstudio.com/')" \
	&& R -e "BiocManager::install('edgeR')" \
    ## set locale encoding in R
    ## must match encoding configuration in docker
    && echo "LC_ALL=C.UTF-8" > /root/.Renviron \
    ## clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/ \
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

RUN mkdir -p /home/root/pp && cd /home/root/pp && mkdir app && mkdir tp && mkdir cache && mkdir tools

RUN if [ "$ARCH" = "x86_64" ]; then \
        wget https://proteinpaint.stjude.org/ppdemo/tools/linux/straw -P /home/root/pp/tools/ && \
        wget -O /usr/local/bin/clustalo http://www.clustal.org/omega/clustalo-1.2.4-Ubuntu-x86_64 && chmod 755 /usr/local/bin/clustalo && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigWigSummary -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedToBed -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedNamedItems -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$ARCH/bigBedInfo -P /home/root/pp/tools/ && \
        chmod -R 755 /home/root/pp/tools; \
    elif [ "$ARCH" = "aarch64" ]; then \
        curl http://www.clustal.org/omega/clustal-omega-1.2.4.tar.gz -O && tar -xvf clustal-omega-1.2.4.tar.gz && \
        cd clustal-omega-1.2.4 && ./configure --prefix="/usr/local" --build=${ARCH}-unknown-linux-gnu && make && make install && \
        chmod 755 /usr/local/bin/clustalo; \
    else \
        echo "unknown ARCH='$ARCH'" && \
        exit 1; \
    fi

# Separate rust build so that the compiled code may be copied later
# in isolation, without including all the rust toolchain in the image
FROM ppbase AS pprust

RUN apt-get update && apt-get install -y clang; \
    set -eux; \
    wget https://static.rust-lang.org/rustup/dist/${ARCH}-unknown-linux-gnu/rustup-init; \
    chmod +x rustup-init; \
    ./rustup-init -y --no-modify-path --default-toolchain stable; \
    rm rustup-init; \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME; \
    rustup --version; \
    cargo --version; \
    rustc --version; \
    cd ${CARGO_HOME} && echo "net.git-fetch-with-cli = true" > config.toml; \
    cargo install sccache \
    ## clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/

WORKDIR /home/root/pp/app

# enable ssh into this stage, for troubleshooting
CMD ["sleep", "3600"]

#####################
# Server-only install
######################

# target for the backend-only SJ package with compiled rust binaries
FROM pprust AS ppserverdeps

WORKDIR /home/root/pp

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

# TODO: pre-compile pp-rust build for download during postinstall, so that 
# the smaller ppbase image without the rust toolchain can be used here
# For now, use pprust in this build stage to support `npm update` with rust binary compilation
FROM pprust AS ppserver

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

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM pprust AS ppfulldeps

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

# TODO: pre-compile pp-rust build for download during postinstall, so that 
# the smaller ppbase image without the rust toolchain can be used here
# For now, use pprust in this build stage to support `npm update` with rust binary compilation
FROM pprust AS ppfull

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
