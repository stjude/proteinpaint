# Proteinpaint Full App

This will build a Docker image with both Proteinpaint server and frontend code.

NOTE: You must have a [Docker Engine or Desktop](https://www.docker.com/) to build
from a Dockerfile source code. 

```bash
cd proteinpaint

./build/build.sh

# example usage, where build/full has
# - a serverconfig.json
# - a public directory

cd build/full
./run.sh
```