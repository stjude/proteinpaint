###################
# Test-only target 
###################

ARG IMGVER=latest
ARG PKGVER=0.0.0
FROM ppbase:$IMGVER AS ppgdctest

# Install Electron system dependencies
# - for testing only
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


#Dependencies: Importing from Dockerfile.gdc to test
ARG htsversion=1.11

RUN curl -L https://github.com/samtools/htslib/releases/download/${htsversion}/htslib-${htsversion}.tar.bz2 | tar xj && \
    (cd htslib-${htsversion} && ./configure --enable-plugins --with-plugin-path='$(libexecdir)/htslib:/usr/libexec/htslib' && make install) && \
    ldconfig && \
    curl -L https://github.com/samtools/samtools/releases/download/${htsversion}/samtools-${htsversion}.tar.bz2 | tar xj && \
    (cd samtools-${htsversion} && ./configure --with-htslib=system && make install) && \
    curl -L https://github.com/samtools/bcftools/releases/download/${htsversion}/bcftools-${htsversion}.tar.bz2 | tar xj && \
    (cd bcftools-${htsversion} && ./configure --enable-libgsl --with-htslib=system && make install)

RUN mkdir -p /home/root/pp

RUN wget https://pecan.stjude.cloud/static/pp-support/linux/straw -P /home/root/pp/tools/ && \
        wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64.v369/bigWigSummary -P /home/root/pp/tools/

# Install NPM deps
WORKDIR /home/root/pp/app 
ADD server ./server
ADD client ./client
COPY package.json ./
RUN npm run reset

# Bundle the server code
WORKDIR /home/root/pp/app/server
RUN npx webpack --config=webpack.config.js --env.devtool=cheap-source-map

# Test
WORKDIR /home/root/pp/app 
ADD targets ./targets

# For now, must mount a developer's local serverconfig.tpmasterdir
# in order to run the GDC test in a running container
#CMD [ "/bin/bash", "./targets/gdc/test.sh"]

# TODO: run the GDC tests as part of building a Docker image,
# to act as a quality control step before building a 
# publishable build target in this Dockerfile
# !!! requires extracting data subsets for testing Lolliplot wrapper !!!
# RUN ./targets/gdc/test.sh


########
# PACK 
########

FROM ppgdctest AS pppacks
ARG PKGVER=0.0.0

# Pack the server use later in the published image target
WORKDIR /home/root/pp/app/server
RUN npm pack && tar -xvzf stjude-proteinpaint-server-$PKGVER.tgz

WORKDIR /home/root/pp/app/client
# the .npmrc must have an entry of @stjude:registry=https://my.pkg.registry.somewhere/
# COPY .npmrc .  
# RUN npx rollup -c ./rollup.config.js && sed i.bak 's/proteinpaint-client/proteinpaint/' package.json && npm publish # to a private registry
#   --  or --
# RUN npx rollup -c ./rollup.config.js && sed i.bak 's/proteinpaint-client/proteinpaint/' package.json && npm pack && scp stjude-proteinpaint-$PKGVER.tgz host:/some/where

############################
# Proteinpaint server image 
############################

ARG IMGVER=latest

# use the ppbase image which does NOT have 
# the Xvfb-related libs and NPM devDependencies installed 
FROM ppbase:$IMGVER as ppserver
COPY --from=pppacks /home/root/pp/app/server/package /home/root/pp/app/server

WORKDIR /home/root/pp/app/server
RUN npm install --production
WORKDIR /home/root/pp/app/
COPY ./LICENSE ./
CMD ["node", "server/bin.js"]
