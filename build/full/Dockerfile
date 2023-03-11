ARG IMGVER=latest
ARG PKGVER=2.11.0

#################
# Package build
#################

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM pprust:$IMGVER AS ppapp
ARG PKGVER

# RUN apt-get update && apt-get install -y libsdl-pango-dev \
#	## clean up
#  && apt-get clean \ 
#  && rm -rf /var/lib/apt/lists/ \ 
#  && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

# RUN if [ "$ARCH" = "aarch64" ]; then npm install canvas --build-from-source; fi

WORKDIR /home/root/pp
COPY ./build/full/stjude-proteinpaint-full-${PKGVER}.tgz .
# RUN npm pack @stjude/proteinpaint-full # TODO: pull the tarball from a registry, instead of COPY
RUN tar -xzf stjude-proteinpaint-full-${PKGVER}.tgz -C app && mv app/package app/active 

WORKDIR /home/root/pp/app/active
COPY ./build/full/.npmrc .
RUN npm install && rm .npmrc

EXPOSE 3000
CMD ["sh", "-c", "node app.js"]
#CMD ["sleep", "3600"]
