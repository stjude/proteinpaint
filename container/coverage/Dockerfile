#########################
# Server-only app update
#########################

FROM ppserver:latest

# the local ppserver:latest has the correct packed tgz entries 
# for updated workspace dependencies
RUN mkdir server && cp node_modules/@sjcrh/proteinpaint-server/package.json server/
WORKDIR /home/root/pp/app/active/server
# run npm install as early as possible, to cache/reuse as image layer;
# this install dev deps that are not in production image
RUN npm install

# copy other artifacts that are more prone to changes 
# and should not trigger unnecessary npm install
COPY ./server ./
RUN sed -i.bak "s|coverage.js & |coverage.js|g" package.json

EXPOSE 3000
# sleep after the test run, so that the container
# does not crash while c8 is generating coverage report, and
# will give enough time for the scripts to copy the reports
# from the container to local host dir
CMD ["sh", "-c", "npm run combined:coverage; sleep 25; exit 0"]
# CMD ["sleep", "3600"]
