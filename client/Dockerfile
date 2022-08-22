FROM node:16.16.0-slim as build

USER node
RUN mkdir /home/node/app

WORKDIR /home/node
COPY --chown=node:node /client/package.json ./


ENV PATH=/home/node/node_modules/.bin:$PATH

WORKDIR /home/node/app

FROM pprust:$IMGVER AS pppkg

COPY --from=pppkg /home/root/pp/tmppack/node_modules .



CMD ["npm", "run", "start"]