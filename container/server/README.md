# Proteinpaint Server-Only App

This will build a Docker image with Proteinpaint server-only code.
No public/html files will be served

NOTE: You must have a [Docker Engine or Desktop](https://www.docker.com/) to build
from a Dockerfile source code. 

```bash
cd proteinpaint/container

./build.sh

# to test, make sure that proteinpaint/container/server has
#
# - a serverconfig.json, which has a "url": "http://localhost:[PORT]" entry 
#   (default PORT=3456, can be set to any valid, non-conflicting numeric port value)
#
# - a dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
#   that is not already included in proteinpaint/server/dataset 

cd server
./run.sh

# open the browser to your serverconfig.url entry
# example routes to check, assuming serverconfig.url=http://localhost:3456
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
```