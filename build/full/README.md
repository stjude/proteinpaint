# Proteinpaint Full App

This will build a Docker image with both Proteinpaint server and frontend code.

NOTE: You must have a [Docker Engine or Desktop](https://www.docker.com/) to build
from a Dockerfile source code. 

```bash
cd proteinpaint

./build/build.sh

# example usage, where build/full has
#
# - a serverconfig.json, which has a "url": "http://localhost:3456" entry 
#   and where the port 3456 can be set to any valid, non-conflicting port value
#
# - an optional dataset folder, containing js files of any serverconfig.genomes.datasets[] entry
#   that is not already included in proteinpaint/full/dataset 
#   
# - an optional public folder, containing any html page that embed proteinpaint views


cd build/full
./run.sh

# open the browser to `http://localhost:3456` or whatever port value you used in the serverconfig.url entry
# example routes to check
# http://localhost:3456/healthcheck
# http://localhost:3456/genomes
# http://localhost:3456: should open the Proteinpaint landing page
```