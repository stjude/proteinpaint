FROM pprust:latest AS ppdev

WORKDIR /home/root/pp/app
RUN mkdir rust && mkdir server && mkdir client
ADD ./rust/*.* ./rust/
ADD ./rust/src ./rust/src
ADD ./server/package.json ./server/package.json
ADD ./client/package.json ./client/package.json
ADD package.json ./
RUN npm install --worskpace=server

ADD webpack.config.js ./

EXPOSE 3000
CMD [ "sh", "-c", "npm run dev & npm start > log.txt"]
# CMD ["sleep", "3600"]
