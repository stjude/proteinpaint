ARG IMGVER=latest

#################
# Package build
#################

# target for the full (backend + frontend) SJ package with compiled rust binaries
FROM pprust:$IMGVER AS pppkg

WORKDIR /home/root/pp

ARG PKGVER=0.0.0
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz

ADD tmppack ./tmppack
WORKDIR /home/root/pp/tmppack
RUN ./build/pp-dist/pack.sh

WORKDIR /home/root/pp/app
RUN export RUSTC_WRAPPER=$(which sccache)
RUN npm install ../tmppack/$PKGTGZ

COPY ./build/pp-dist/setup.sh .

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
