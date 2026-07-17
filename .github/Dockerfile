#Unit test image for ProteinPaint (server+Python workspaces).

# Pull the published base (whole environment: Node, /opt/venv Python, R, samtools) from GHCR
FROM ghcr.io/stjude/ppserver:latest

WORKDIR /home/root/proteinpaint

COPY . .

RUN npm ci

RUN pip3 install -r python/requirements.txt

# The server's test:unit writes to ./cache while running (and deletes it after),
# but requires the dir to exist first.
RUN mkdir -p server/cache

# Default command at `docker run`: server unit tests, then python tests.
# `sh -c` chains them; a failure in either sets a non-zero exit code (fails CI).
CMD ["sh", "-c", "npm run test:unit -w=server && npm test -w=python"]