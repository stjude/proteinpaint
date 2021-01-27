# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library


FROM ${registry}/node:12-stretch AS ppdeps

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

 
#####################
 
FROM ppdeps AS dev
 
WORKDIR /home/root/pp
COPY package.json ./
RUN npm install
WORKDIR /home/root/pp/app
ENV PP_MODE container-dev
ENTRYPOINT [ "../node_modules/nodemon/bin/nodemon.js", "server.js"]
CMD ["--watch", "server.js", "--watch genome --watch dataset --watch serverconfig.json" ]


######################

FROM ppdeps AS pppack

# Install dependencies to get webpack and other packing tools.
# Copy only package.json for now to make this layer easier to cache.
COPY package.json /home/root/pp/build/package.json
WORKDIR /home/root/pp/build
RUN npm install

# Package the backend code into ./tmppack/package
COPY ./ ./
RUN ./build/pack.sh -b


#####################

FROM ppdeps AS test

CMD [ "npm", "run", "test-react" ]


######################

FROM ppdeps AS prod-bare

WORKDIR /home/root/pp/app

# TODO Stash the production modules somewhere during an earlier phase
# so we don't have to reinstall them.
COPY --from=pppack /home/root/pp/build/tmppack/package/package.json ./package.json
RUN npm install --production

# TODO Possibly modify backend packing to omit the public directory.
# If the directory is present, ProteinPaint will try to remove it on
# startup, which prevents running as a non-privileged user.
COPY --from=pppack /home/root/pp/build/tmppack/package ./
RUN rm -rf ./public

ADD genome ./genome
ADD dataset ./dataset
ENV PP_MODE container-prod
CMD [ "node", "bin.js" ]


######################

FROM prod-bare AS prod

COPY ./serverconfig.json ./
CMD [ "node", "bin.js" ]
