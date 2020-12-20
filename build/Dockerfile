FROM node:12-stretch AS ppdeps

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
	r-base \
	g++ \
    ## clean up
    && apt-get clean \ 
    && rm -rf /var/lib/apt/lists/ \ 
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds
  
ARG htsversion=1.11

RUN curl -L https://github.com/samtools/htslib/releases/download/${htsversion}/htslib-${htsversion}.tar.bz2 | tar xj && \
    (cd htslib-${htsversion} && ./configure --enable-plugins --with-plugin-path='$(libexecdir)/htslib:/usr/libexec/htslib' && make install) && \
    ldconfig && \
    curl -L https://github.com/samtools/samtools/releases/download/${htsversion}/samtools-${htsversion}.tar.bz2 | tar xj && \
    (cd samtools-${htsversion} && ./configure --with-htslib=system && make install) && \
    curl -L https://github.com/samtools/bcftools/releases/download/${htsversion}/bcftools-${htsversion}.tar.bz2 | tar xj && \
    (cd bcftools-${htsversion} && ./configure --enable-libgsl --with-htslib=system && make install)

RUN mkdir -p /home/root/pp && cd /home/root/pp && mkdir app && mkdir tp && mkdir cache && mkdir tools

RUN wget https://pecan.stjude.cloud/static/pp-support/linux/straw -P /home/root/pp/tools/ && \
	wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64.v369/bigWigSummary -P /home/root/pp/tools/

WORKDIR /home/root/pp/app
COPY package.json ./
RUN npm install

ADD build ./build
COPY app.js ./
COPY stjude-proteinpaint-1.7.0.tgz ./
RUN tar -xzf stjude-proteinpaint-1.7.0.tgz --strip-components=1

# customize by removing or removing files and directories
RUN rm server.js
RUN rm -r genome
RUN rm -r dataset
ADD src ./src
ADD genome ./genome
ADD dataset ./dataset
ADD modules ./modules

COPY serverconfig.json ./
COPY build/set-container-config.js ./
RUN node set-container-config

RUN npx webpack --config=build/webpack.config.server.js --mode=development

CMD [ "node", "server.js" ]
