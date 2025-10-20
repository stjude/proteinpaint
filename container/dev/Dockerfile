FROM ghcr.io/stjude/ppbase:latest

ARG IMGREV=""
ARG IMGVER=""

# Install python dependencies
RUN python3 -m venv /opt/venv && \
    pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install pre-commit && \
    ## clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/downloaded_packages/ /tmp/*.rds

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

WORKDIR /home/root/proteinpaint/

EXPOSE 3000
CMD ["sh", "-c", "npm install && npm run build && npm run dev1"]

