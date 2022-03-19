ARG IMGVER=latest

#
# target for the full (backend + frontend) SJ package with compiled rust binaries
#
FROM pprust:$IMGVER AS pppkg

WORKDIR /home/root/pp

ARG PKGVER=0.0.0
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz
COPY $PKGTGZ .

WORKDIR /home/root/pp/app
RUN export RUSTC_WRAPPER=$(which sccache)
RUN npm install ../$PKGTGZ
COPY ./build/pp-dist/setup.sh .

#
# final app image, with the Rust-compiled binaries and without the Rust toolchain
# 
FROM ppbase:$IMGVER AS ppapp

WORKDIR /home/root/pp/app
COPY --from=pppkg /home/root/pp/app /home/root/pp/app

EXPOSE 3000
CMD [ "sh", "-c", "./setup.sh && PP_MODE=container-prod npx proteinpaint"]
