# Proteinpaint Full App

This will build a Docker image with both Proteinpaint server and frontend code.

NOTE: You must have a [Docker Engine or Desktop](https://www.docker.com/) to build
from a Dockerfile source code. 

```bash
cd proteinpaint

./build.sh

# to test, make sure that proteinpaint/container/full has
#
# - a serverconfig.json, which has a "url": "http://localhost:[PORT]" entry 
#   (default PORT=3456, can be set to any valid, non-conflicting numeric port value)
#
# - an optional dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
#   that is not already included in proteinpaint/server/dataset 
#   
# - an optional public folder, containing any html page that embed proteinpaint views


cd full
./run.sh

# open the browser to your serverconfig.url entry
# example routes to check, assuming serverconfig.url=http://localhost:3456
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
# http://localhost:3456: should open the Proteinpaint landing page
```