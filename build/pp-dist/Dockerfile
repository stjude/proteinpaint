ARG IMGVER=latest
FROM ppbase:$IMGVER

WORKDIR /home/root/pp

ARG PKGVER=0.0.0
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz
COPY $PKGTGZ .

WORKDIR /home/root/pp/app
RUN npm install ../$PKGTGZ
COPY ./build/pp-dist/setup.sh .

RUN export RUSTC_WRAPPER=$(which sccache)

WORKDIR /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/rust_indel_cargo
RUN cargo build --release
RUN rm -rf ./src
WORKDIR /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/read_alignment
RUN cargo build --release
RUN rm -rf ./src

WORKDIR /home/root/pp/app
EXPOSE 3456
CMD [ "sh", "-c", "./setup.sh && PP_MODE=container-prod npx proteinpaint"]
