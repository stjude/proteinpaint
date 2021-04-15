ARG PKGVER=0.0.0
FROM ppbase:$PKGVER

ARG PKGVER
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz
WORKDIR /home/root/pp

COPY $PKGTGZ .
WORKDIR /home/root/pp/app
RUN npm install ../$PKGTGZ
ENV PP_MODE container-dev
ADD server/dataset ./dataset
COPY serverconfig.json ./
CMD [ "npx", "proteinpaint"]
