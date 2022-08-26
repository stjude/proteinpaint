FROM pprust:latest AS ppdev

WORKDIR /home/root/pp/app
RUN mkdir rust && mkdir server && mkdir client
ADD ./rust/*.* ./rust/
ADD ./rust/src ./rust/src
ADD ./min-package.json ./package.json
ADD ./client/min-package.json ./client/package.json
ADD ./server/min-package.json ./server/package.json
ADD ./client/min-package.json ./client/package.json
RUN npm install --worskpace=server

RUN mkdir /home/root/pp/cache/dsSessions
ADD webpack.config.js ./

EXPOSE 3000
CMD [ "sh", "-c", "npm run dev & npm start"]
# CMD ["sleep", "3600"]
