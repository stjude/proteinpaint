ARG IMGVER=latest

FROM ppminpkg:$IMGVER AS ppminpkg

#################
# Package build
#################

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM pprust:$IMGVER AS pppkg

# install from minimal package.json to help with layer caching
WORKDIR /home/root/pp
COPY --from=ppminpkg /home/root/pp/tmppack /home/root/pp/tmppack
WORKDIR /home/root/pp/tmppack
ARG ELECTRON_GET_USE_PROXY=false
ARG GLOBAL_AGENT_HTTPS_PROXY=""

RUN apt-get update && apt-get install -y libsdl-pango-dev \
	## clean up
  && apt-get clean \ 
  && rm -rf /var/lib/apt/lists/ \ 
  && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

RUN if [ "$ARCH" = "aarch64" ]; then npm install canvas --build-from-source; fi
RUN npm -D install
ADD . .
RUN ./build/full/pack.sh
WORKDIR /home/root/pp/app
RUN export RUSTC_WRAPPER=$(which sccache)
ARG PKGVER=0.0.0

# # todo: may rename package with version number to publish
RUN cp -r ../tmppack/node_modules . 
RUN npm install node-pre-gyp
RUN npm install ../tmppack/stjude-proteinpaint.tgz

COPY ./build/full/setup.sh .
# run this image to copy artifacts from the Docker process for troubleshooting 
CMD ["sleep", "3600"]

#################
# Testable build
#################

#
# final app image, with the Rust-compiled binaries and without the Rust toolchain
# 
FROM ppbase:$IMGVER AS ppapp

WORKDIR /home/root/pp/app
COPY --from=pppkg /home/root/pp/app /home/root/pp/app

EXPOSE 3000
CMD [ "sh", "-c", "./setup.sh && PP_MODE=container-prod npx proteinpaint"]
