#Unit test image for ProteinPaint (server+Python workspaces).

# Pull the published base (whole environment: Node, /opt/venv Python, R, samtools) from GHCR
FROM ghcr.io/stjude/ppserver:latest

WORKDIR /home/root/proteinpaint

COPY . .

RUN npm ci

# The server imports @sjcrh/proteinpaint-rust, which requires the compiled binaries at
# rust/target/release/ when it loads. The workspace postinstall skips fetching them
# (because rust/test/ exists in full source), so download the prebuilt binaries explicitly.
RUN mkdir -p rust/target/release && cd rust && node downloadBinariesOrCompileSource.js


RUN pip3 install -r python/requirements.txt

# The server's test:unit writes to ./cache while running (and deletes it after),
# but requires the dir to exist first.
RUN mkdir -p server/cache

# Default command at `docker run`: server unit tests, then python tests.
# `sh -c` chains them; a failure in either sets a non-zero exit code (fails CI).
CMD ["sh", "-c", "npm run test:unit -w=server && npm test -w=python"]