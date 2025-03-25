# from container dir, 
# run `./build2.sh -z server` first,
# then `./build2.sh coverage`

#########################
# Server-only app update
#########################

FROM ppserver:latest

RUN mkdir server
WORKDIR /home/root/pp/app/active/server
COPY ./server/package.json ./package.json
COPY ./server/sjcrh-augen.tgz ./sjcrh-augen.tgz

# run npm install as early as possible, to cache/reuse as image layer;
# this install dev deps that are not in production image
RUN npm install

# copy other artifacts that are more prone to changes 
# and should not trigger unnecessary npm install
COPY ./server ./

EXPOSE 3000
# restart the server after the test run, so that the container
# does not crash while c8 is generating coverage report, and
# the restarted server will react to external /closeCoverage 
# request to finally stop the container
CMD ["sh", "-c", "npm run combined:coverage && closeCoverageKey=test npx tsx src/app.ts"]
# CMD ["sleep", "3600"]
