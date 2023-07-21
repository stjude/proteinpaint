# Default to Docker Hub, but enable the base image to be pulled from a
# different registry by setting the registry arg at build time.
ARG registry=docker.io/library
ARG VERSION=2.22.1

#########################
# Server-only app update
#########################

FROM ghcr.io/stjude/ppserver:$VERSION AS ppserver

WORKDIR /home/root/pp
COPY tmppack ./tmppack

WORKDIR /home/root/pp/app/active
ARG SERVERPKGVER
ARG SERVERPKGNAME=@sjcrh/proteinpaint-server@${SERVERPKGVER}
RUN npm install $SERVERPKGNAME
EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-server.js"]
# CMD ["sleep", "3600"]

#########################
# Full app update
#########################

FROM ppserver AS ppfull
WORKDIR /home/root/pp/app/active

ARG FRONTPKGVER
ARG FRONTPKGNAME=@sjcrh/proteinpaint-front@${FRONTPKGVER}
RUN npm install $FRONTPKGNAME
COPY ./app-full.js ./
COPY public ./public

EXPOSE 3000
CMD ["sh", "-c", "node --enable-source-maps app-full.js"]
