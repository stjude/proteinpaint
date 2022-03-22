ARG IMGVER=latest

#################
# Package build
#################

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM pprust:$IMGVER AS pppkg

# install from minimal package.json to help with layer caching
WORKDIR /home/root/pp
ADD ./minpkgjsons ./tmppack
WORKDIR /home/root/pp/tmppack
RUN npm install --workspaces

ADD . .
RUN ./build/full/pack.sh
WORKDIR /home/root/pp/app
RUN export RUSTC_WRAPPER=$(which sccache)
ARG PKGVER=0.0.0

# todo: may rename package with version number to publish
ENV PKGTGZ=stjude-proteinpaint.tgz
RUN npm install ../tmppack/$PKGTGZ

COPY ./build/full/setup.sh .
# run this image tocopy artifacts from the Docker process for troubleshooting 
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
