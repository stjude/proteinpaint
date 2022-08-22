FROM node:18.7.0-slim as build

USER node
RUN mkdir /home/node/app

WORKDIR /home/node
COPY --chown=node:node /client/package.json ./


ENV PATH=/home/node/node_modules/.bin:$PATH

WORKDIR /home/node/app
RUN npm install

CMD ["npm", "run", "start"]