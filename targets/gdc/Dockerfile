ARG PKGVER=0.0.0
FROM ppbase:$PKGVER as ppdeps

##############################
# Electron-system dependencies
##############################

RUN apt-get update && apt-get install --no-install-recommends -y \
 	xauth \
  libxfont2 \
 	xvfb \
 	libnss3 \
 	libasound2 \
 	libnotify4 \
  libgconf2-4 \
  libnss3 \
  libxtst-dev \
  libc6 \
  libstdc++6 \
  libgcc1 \
  libgtk2.0-0 \
  libgtk-3-0 \
  libasound2 \
  libxrender1 \
  libxss1 \
  	## clean up
    && apt-get clean \ 
    && rm -rf /var/lib/apt/lists/ \ 
    && rm -rf /tmp/downloaded_packages/ /tmp/*.rds

# avoid font-warning that breaks the test message
RUN sed -i '/<blank>/,/<\/blank>/d' /etc/fonts/fonts.conf

####################
# Install NPM deps
####################

WORKDIR /home/root/pp/app 
ADD server ./server
ADD client ./client
COPY package.json ./
RUN npm run reset


###########################
# Bundle the server code
###########################

WORKDIR /home/root/pp/app/server
RUN echo -e "\nCreating the server bundle\n" && \
	npx webpack --config=webpack.config.js --env.devtool=cheap-source-map


##########
# TEST
##########

WORKDIR /home/root/pp/app 
ADD targets ./targets
# RUN ./targets/gdc/test.sh
# CMD ["/bin/bash"]
CMD [ "/bin/bash", "./targets/gdc/test.sh"]
# CMD ["node", "server/bin.js"]

#######################################
# Bundle the client code (ES modules)
#######################################

# to publish PP client package/tarball in a GDC registry
# echo -e "\nPacking the client module main ...\n"
# rm -rf dist
# npx rollup -c ./rollup.config.js
# cd ..

