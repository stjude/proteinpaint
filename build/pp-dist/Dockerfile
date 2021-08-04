ARG IMGVER=latest
FROM ppbase:$IMGVER

WORKDIR /home/root/pp

ARG PKGVER=0.0.0
ENV PKGTGZ=./stjude-proteinpaint-${PKGVER}.tgz
COPY $PKGTGZ .

WORKDIR /home/root/pp/app
RUN npm install ../$PKGTGZ

COPY ./build/pp-dist/setup.sh .

EXPOSE 3456
CMD [ "sh", "-c", "./setup.sh && PP_MODE=container-prod npx proteinpaint"]
