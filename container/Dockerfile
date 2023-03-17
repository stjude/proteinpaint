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

# Separate rust build so that the compiled code may be copied later
# in isolation, without including all the rust toolchain in the image
FROM ppbase AS pprust

RUN set -eux; \
    wget https://static.rust-lang.org/rustup/dist/${ARCH}-unknown-linux-gnu/rustup-init; \
    chmod +x rustup-init; \
    ./rustup-init -y --no-modify-path --default-toolchain stable; \
    rm rustup-init; \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME; \
    rustup --version; \
    cargo --version; \
    rustc --version; \
    cargo install sccache \
    ## clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/

WORKDIR /home/root/pp/app

#####################
# Server-only install
######################

# target for the backend-only SJ package with compiled rust binaries
FROM pprust AS ppserverdeps

WORKDIR /home/root/pp
COPY tmppack ./tmppack

WORKDIR /home/root/pp/app 
RUN mkdir active
# !!! NOTE: after open-sourcing, will only need the @stjude registry URL, no token required !!!
WORKDIR /home/root/pp/app/active
COPY .npmrc ./
ARG SERVERPKGVER
RUN if [ -f /home/root/pp/tmppack/stjude-proteinpaint-server-${SERVERPKGVER}.tgz ]; then \
      npm install /home/root/pp/tmppack/stjude-proteinpaint-server-${SERVERPKGVER}.tgz; \
    else \
      npm install @stjude/proteinpaint-server@${SERVERPKGVER}; \
    fi; \
    rm .npmrc

#####################
# Server-only app
######################

# target for the backend-only SJ server app
FROM ppbase AS ppserver

WORKDIR /home/root/pp/app 
# the copied layer does not have the .npmrc ???
COPY --from=ppserverdeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
COPY ./app-server.js ./
EXPOSE 3000
CMD ["sh", "-c", "node app-server.js"]


#################
# Full install
#################

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM pprust AS ppfulldeps

WORKDIR /home/root/pp
COPY tmppack ./tmppack
WORKDIR /home/root/pp/app
COPY --from=ppserver /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
# !!! NOTE: after open-sourcing, will only need the @stjude registry URL, no token required !!!
COPY ./.npmrc .
ARG FRONTPKGVER
RUN if [ -f /home/root/pp/tmppack/stjude-proteinpaint-front-${FRONTPKGVER}.tgz ]; then \
      npm install /home/root/pp/tmppack/stjude-proteinpaint-front-${FRONTPKGVER}.tgz ; \
    else \
      npm install @stjude/proteinpaint-front@${FRONTPKGVER}; \
    fi; \
    rm .npmrc

############
# Full app
############

# target for the full (backend + frontend) SJ app
FROM ppbase AS ppapp

WORKDIR /home/root/pp/app
# the copied layer does not have the .npmrc ???
COPY --from=ppfulldeps /home/root/pp/app/active /home/root/pp/app/active

WORKDIR /home/root/pp/app/active
COPY ./app-full.js ./
COPY public ./public
EXPOSE 3000
CMD ["sh", "-c", "node app-full.js"]
# CMD ["sleep", "3600"]
