ARG IMGVER=latest
FROM ppbase:$IMGVER AS pppkg

WORKDIR /home/root/pp

ARG PKGVER=0.0.0
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz
COPY $PKGTGZ .

WORKDIR /home/root/pp/app
RUN npm install ../$PKGTGZ
COPY ./build/pp-dist/setup.sh .

# 
# Rust code builder
# 
FROM pprust AS ppcargo
WORKDIR /home/root/pp/app
RUN export RUSTC_WRAPPER=$(which sccache)

COPY --from=pppkg /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/rust /home/root/rust
WORKDIR /home/root/rust
RUN cargo build --release

#
# final app image
# 
FROM pppkg AS ppapp

# copy compiled rust code
WORKDIR /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/rust_indel_cargo
RUN rm -rf src Cargo.*
COPY --from=ppcargo /home/root/rust_indel_cargo/target ./target
RUN rm -rf target/release/deps target/release/build
WORKDIR /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/read_alignment
RUN rm -rf src Cargo.*
COPY --from=ppcargo /home/root/read_alignment/target ./target
RUN rm -rf target/release/deps target/release/build

WORKDIR /home/root/pp/app
EXPOSE 3456
CMD [ "sh", "-c", "./setup.sh && PP_MODE=container-prod npx proteinpaint"]
