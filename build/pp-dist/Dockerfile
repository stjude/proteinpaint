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

COPY --from=pppkg /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/rust_indel_cargo /home/root/rust_indel_cargo
WORKDIR /home/root/rust_indel_cargo
RUN cargo build --release

COPY --from=pppkg /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/read_alignment /home/root/read_alignment
WORKDIR /home/root/read_alignment
RUN cargo build --release

#
# final app image
# 
FROM pppkg AS ppapp

# copy compiled rust code
WORKDIR /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/rust_indel_cargo
RUN rm -rf src Cargo.*
COPY --from=ppcargo /home/root/rust_indel_cargo/target ./target
WORKDIR /home/root/pp/app/node_modules/@stjude/proteinpaint/server/utils/read_alignment
RUN rm -rf src Cargo.*
COPY --from=ppcargo /home/root/read_alignment/target ./target

WORKDIR /home/root/pp/app
EXPOSE 3456
CMD [ "sh", "-c", "./setup.sh && PP_MODE=container-prod npx proteinpaint"]
