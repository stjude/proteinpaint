# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library

FROM ${registry}/node:12-stretch AS ppbase
ARG platform="x86_64"

RUN echo "PLATFORM IS ${platform}"
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN apt-get update && apt-get install -y \
	libbz2-dev \
	libcurl4-openssl-dev \
	libgsl0-dev \
	liblzma-dev \
	libncurses5-dev \
	libperl-dev \
	libssl-dev \
	zlib1g-dev && rm -rf /var/lib/apt/lists/* \
	libcairo2-dev \
	libjpeg-dev \
	libpango1.0-dev \
	libgif-dev \
	sqlite3 libsqlite3-dev \
	g++ \
	## clean up
    && apt-get clean \ 
    && rm -rf /var/lib/apt/lists/ \ 
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

RUN sed -i '/<blank>/,/<\/blank>/d' /etc/fonts/fonts.conf

ARG htsversion=1.14

RUN curl -L https://github.com/samtools/htslib/releases/download/${htsversion}/htslib-${htsversion}.tar.bz2 | tar xj && \
    (cd htslib-${htsversion} && ./configure --enable-plugins --with-plugin-path='$(libexecdir)/htslib:/usr/libexec/htslib' && make install) && \
    ldconfig && \
    curl -L https://github.com/samtools/samtools/releases/download/${htsversion}/samtools-${htsversion}.tar.bz2 | tar xj && \
    (cd samtools-${htsversion} && ./configure --with-htslib=system && make install) && \
    curl -L https://github.com/samtools/bcftools/releases/download/${htsversion}/bcftools-${htsversion}.tar.bz2 | tar xj && \
    (cd bcftools-${htsversion} && ./configure --enable-libgsl --with-htslib=system && make install)

RUN apt-get update && apt-get install -y r-base -y libargtable2-dev \
	## install R packages
 	&& R -e "install.packages(c('cmprsk', 'hwde', 'jsonlite', 'survival', 'lmtest'), dependencies=TRUE, repos='http://cran.rstudio.com/')" \
	## clean up
    && apt-get clean \ 
    && rm -rf /var/lib/apt/lists/ \ 
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

RUN mkdir -p /home/root/pp && cd /home/root/pp && mkdir app && mkdir tp && mkdir cache && mkdir tools

RUN wget https://pecan.stjude.cloud/static/pp-support/linux/straw -P /home/root/pp/tools/ 
RUN curl http://www.clustal.org/omega/clustal-omega-1.2.4.tar.gz -O && tar -xvf clustal-omega-1.2.4.tar.gz
RUN cd clustal-omega-1.2.4 && ./configure --prefix="/usr/local" --build=${platform}-unknown-linux-gnu && make && make install
RUN  chmod 755 /usr/local/bin/clustalo

#RUN wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$platform/bigWigSummary -P /home/root/pp/tools/ && \
#    wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$platform/bigBedToBed -P /home/root/pp/tools/ && \
#    wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.$platform/bigBedNamedItems -P /home/root/pp/tools/


# need npm v7 to support workspaces
RUN npm install --global npm@7

# Separate rust build so that the compiled code may be copied later
# in isolation, without including all the rust toolchain in the image
FROM ppbase AS pprust

RUN set -eux; \
    wget https://static.rust-lang.org/rustup/dist/${platform}-unknown-linux-gnu/rustup-init; \
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


FROM ppbase AS ppminpkg
WORKDIR /home/root/pp
ADD . ./tmppack
WORKDIR /home/root/pp/tmppack

RUN mkdir -p minpkgjsons/server && mkdir minpkgjsons/client && \
     ./build/minpkgjson.js package.json > minpkgjsons/package.json && \
     ./build/minpkgjson.js server/package.json > minpkgjsons/server/package.json && \
     ./build/minpkgjson.js client/package.json > minpkgjsons/client/package.json