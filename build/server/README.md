# Proteinpaint Server-Only App

This will build a Docker image with Proteinpaint server-only code.
No public/html files will be served

NOTE: You must have a [Docker Engine or Desktop](https://www.docker.com/) to build
from a Dockerfile source code. 

```bash
cd proteinpaint

./build/build.sh

# example usage, where build/server has
# - a serverconfig.json

cd build/server
./run.sh
```