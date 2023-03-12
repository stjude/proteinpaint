# Proteinpaint Server-Only App

This will build a Docker image with Proteinpaint server-only code.
No public/html files will be served

NOTE: You must have a [Docker Engine or Desktop](https://www.docker.com/) to build
from a Dockerfile source code. 

```bash
cd proteinpaint

./build/build.sh

# example usage, where build/server has
#
# - a serverconfig.json, which has a "url": "http://localhost:3456" entry 
#   and where the port 3456 can be set to any valid, non-conflicting port value
#
# - a dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
#   that is not already included in proteinpaint/server/dataset 

cd build/server
./run.sh

# open the browser to `http://localhost:3456` or whatever port value you used in the serverconfig.url entry
# example routes to check
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
```