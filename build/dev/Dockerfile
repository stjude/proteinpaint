FROM ghcr.io/stjude/ppserver AS ppdev

# RUN apt-get update && apt-get install -y libsdl-pango-dev \
# 	## clean up
#   && apt-get clean \ 
#   && rm -rf /var/lib/apt/lists/ \ 
#   && rm -rf /tmp/downloaded_packages/ /tmp/*.rds
# RUN if [ $(uname -m) = "arm64" ]; then npm install canvas --build-from-source; fi

# WORKDIR /home/root/pp/app
# RUN mkdir rust && mkdir server && mkdir client
# ADD ./rust/*.* ./rust/
# ADD ./rust/src ./rust/src
# ADD ./min-package.json ./package.json
# ADD ./client/min-package.json ./client/package.json
# ADD ./server/min-package.json ./server/package.json
# RUN npm install --worskpace=server

# RUN mkdir /home/root/pp/cache/dsSessions
# ADD webpack.config.js ./

EXPOSE 3000
ENV script=dev1
WORKDIR /home/root/pp/app/active
RUN rm -rf public/cards

CMD [ "sh", "-c", "npx proteinpaint-server"]
# CMD ["sleep", "3600"]
