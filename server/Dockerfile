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

USER node

RUN mkdir -p /home/node/pp && cd /home/node/pp && mkdir app && mkdir tp && mkdir cache && mkdir tools && mkdir build

RUN wget https://pecan.stjude.cloud/static/pp-support/linux/straw -P /home/node/pp/tools/ && \
	wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64.v369/bigWigSummary -P /home/node/pp/tools/

######################

FROM ppdeps AS pppack

WORKDIR /home/node/pp/app
# Copy only package.json for now to make this layer easier to cache.
COPY --chown=node:node ./package.json ./
# Install dependencies to get webpack and other packing tools.
RUN npm install
COPY --chown=node:node ./ ./
RUN npx webpack --config=build/webpack.config.server.js --env.NODE_ENV=production
RUN echo -e "\nBundling the client browser dist ...\n"
RUN npx webpack --config=./build/webpack.config.client.js --env.url="__PP_URL__"
RUN echo -e "\nBundling the esm module dist ...\n"
RUN npx rollup -c ./build/rollup.config.js
EXPOSE 3456
CMD [ "node", "bin.js" ]

# npm pack
# clean up
# extract package
# WORKDIR /home/node/pp/app/package

######################
FROM pppack AS ppfull

# remove all devDependencies ??? re-install testing deps later???

######################
FROM pppack AS ppbare

# remove all non-server code, copy only the server bundle
# and required node_modules like better-sqlite, etc
# to create a server container

#######################
FROM pppack AS ppgdctest
# RUN echo $(PP_CUSTOMER=gdc PP_MODE=container-test PP_PORT=3456 node -p "require('./modules/serverconfig.js')") > serverconfig.json

USER root
RUN apt-get update && apt-get install --no-install-recommends -y \
 	xauth \
  libxfont2 \
 	xvfb \
 	libnss3 \
 	libasound2 \
 	libnotify4 \
  libgconf2-4 \
  libnss3 \
  libxtst-dev \
  libc6 \
  libstdc++6 \
  libgcc1 \
  libgtk2.0-0 \
  libgtk-3-0 \
  libasound2 \
  libxrender1 \
  libxss1 \
  	## clean up
    && apt-get clean \ 
    && rm -rf /var/lib/apt/lists/ \ 
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

# avoid font-warning that breaks the test message
RUN sed -i '/<blank>/,/<\/blank>/d' /etc/fonts/fonts.conf
RUN echo $(PP_CUSTOMER=gdc PP_MODE=container-test PP_PORT=3456 node -p "JSON.stringify(require('./modules/serverconfig.js'))") > serverconfig.json

USER node
RUN Xvfb -ac -screen scrn 1280x2000x24 :9.0 -nolisten unix & export DISPLAY=:9.0

CMD [ "node", "bin.js", "&", "npm", "run", "test-gdc" ]




























