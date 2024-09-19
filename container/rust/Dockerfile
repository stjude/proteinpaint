FROM rust:1.78-slim-bookworm

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.version="latest"

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    librsvg2-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    sqlite3 libsqlite3-dev \
    libhdf5-dev  \
	## clean up
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/ \
  && rm -rf /tmp/downloaded_packages/ /tmp/*.rds


RUN apt-get update && apt-get install -y clang; \
    cargo install sccache \
    ## clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/

WORKDIR /home/root/rust