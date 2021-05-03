ARG IMGVER=latest
FROM ppbase:$IMGVER

ARG PKGVER=0.0.0
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz
WORKDIR /home/root/pp

COPY $PKGTGZ .
WORKDIR /home/root/pp/app
RUN npm install ./$PKGTGZ
ENV PP_MODE container-dev
ADD server/dataset ./dataset
CMD [ "npx", "proteinpaint"]
