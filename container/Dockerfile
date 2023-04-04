# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library

FROM ${registry}/node:16-buster-slim AS ppbase
ARG ARCH='x86_64'
ENV ARCH=$ARCH

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    build-essential \
    librsvg2-dev \
	libbz2-dev \
	libcurl4-openssl-dev \
	libgsl0-dev \
	liblzma-dev \
	libncurses5-dev \
	libperl-dev \
	libssl-dev \
	zlib1g-dev && rm -rf /var/lib/apt/lists/* \
    libcairo-dev \
	libjpeg-dev \
	libgif-dev \
	sqlite3 libsqlite3-dev \
	g++ \
    pkg-config \
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

RUN apt-get update && apt-get install -y r-base -y libargtable2-dev \
	## install R packages
 	&& R -e "install.packages(c('cmprsk', 'hwde', 'jsonlite', 'survival', 'lmtest'), dependencies=TRUE, repos='http://cran.rstudio.com/')" \
	## clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/ \
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds


RUN mkdir -p /home/root/pp && cd /home/root/pp && mkdir app && mkdir tp && mkdir cache && mkdir tools

RUN if [ "$ARCH" = "x86_64" ]; then \
        wget https://pecan.stjude.cloud/static/pp-support/linux/straw -P /home/root/pp/tools/ && \
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

RUN chown -R node:node /home/root/pp

######################################
# pp-rust package npm copy since the 
# rust base image does not have npm
######################################

FROM ppbase AS pprustpkg

WORKDIR /home/root/pp
COPY tmppack ./tmppack

ARG RUSTPKGVER=2.9.1
# pull the pp-rust package as a tarball, 
# since the base rust image in the next stage
# does not have node or npm
RUN if [ ! -f "/home/root/pp/tmppack/sjcrh-proteinpaint-rust-$RUSTPKGVER.tgz" ]; then \
      npm pack @sjcrh/proteinpaint-rust@$RUSTPKGVER; \
    fi

###########################################
# Stage for compiling the pp-rust binaries
###########################################

# Separate rust build so that the compiled code may be copied later
# in isolation, without including all the rust toolchain in the image
FROM ${registry}/rust:1-buster AS pprust

WORKDIR /home/root/pp
# TODO: separate rust cargo dependencies before installing pp-rust, for better build caching
# USER node
COPY tmppack ./tmppack
ARG RUSTPKGVER=2.9.1
COPY --from=pprustpkg /home/root/pp/tmppack/sjcrh-proteinpaint-rust-${RUSTPKGVER}.tgz /home/root/pp/tmppack/sjcrh-proteinpaint-rust-${RUSTPKGVER}.tgz

RUN tar -xzf /home/root/pp/tmppack/sjcrh-proteinpaint-rust-${RUSTPKGVER}.tgz && \
    cd package && \
    cargo build --release && \
    cd .. && \
    tar -czf tmppack/sjcrh-proteinpaint-rust-${RUSTPKGVER}.tgz package

CMD ["sleep", "3600"]

######################
# Server-deps install
######################

# target for the backend-only SJ package with compiled rust binaries
FROM ppbase AS ppserverdeps

WORKDIR /home/root/pp
# TODO: separate npm install dependencies before installing pp packages, for better build caching
COPY tmppack ./tmppack
ARG RUSTPKGVER=2.9.1
COPY --from=pprust /home/root/pp/tmppack/sjcrh-proteinpaint-rust-${RUSTPKGVER}.tgz /home/root/pp/tmppack/sjcrh-proteinpaint-rust-${RUSTPKGVER}.tgz

WORKDIR /home/root/pp/app 
RUN mkdir active
# !!! NOTE: after open-sourcing, will only need the @sjcrh registry URL, no token required !!!
WORKDIR /home/root/pp/app/active
ARG SERVERPKGVER=2.12.1
RUN if [ -f /home/root/pp/tmppack/sjcrh-proteinpaint-server-${SERVERPKGVER}.tgz ]; then \
      npm install /home/root/pp/tmppack/sjcrh-proteinpaint-server-${SERVERPKGVER}.tgz; \
    else \
      npm install @sjcrh/proteinpaint-server@${SERVERPKGVER}; \
    fi

# enable ssh into this stage, for troubleshooting
CMD ["sleep", "3600"]

###########################
# Server-only app, 
# no /home/root/pp/tmppack
###########################

# target for the backend-only SJ server app
FROM ppbase AS ppserver

LABEL org.opencontainers.image.source="https://github.com/sjcrh/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

WORKDIR /home/root/pp/app
COPY --from=ppserverdeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
COPY ./app-server.js ./
EXPOSE 3000
CMD ["sh", "-c", "node app-server.js"]
# CMD ["sleep", "3600"]

#################
# Full install
#################

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM ppbase AS ppfulldeps

WORKDIR /home/root/pp
COPY tmppack ./tmppack
WORKDIR /home/root/pp/app
COPY --from=ppserver /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
ARG FRONTPKGVER=2.12.1
RUN if [ -f /home/root/pp/tmppack/sjcrh-proteinpaint-front-${FRONTPKGVER}.tgz ]; then \
      npm install /home/root/pp/tmppack/sjcrh-proteinpaint-front-${FRONTPKGVER}.tgz ; \
    else \
      npm install @sjcrh/proteinpaint-front@${FRONTPKGVER}; \
    fi

# enable ssh into this stage, for troubleshooting
CMD ["sleep", "3600"]

############
# Full app
############

# target for the full (backend + frontend) SJ app
FROM ppbase AS ppfull

LABEL org.opencontainers.image.source="https://github.com/sjcrh/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

WORKDIR /home/root/pp/app
COPY --from=ppfulldeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
COPY ./app-full.js ./
COPY public ./public
EXPOSE 3000
CMD ["sh", "-c", "node app-full.js"]
# CMD ["sleep", "3600"]
