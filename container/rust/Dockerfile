FROM rust:1.86-slim-bookworm

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.version="latest"

# Install dependencies
RUN apt-get update && apt-get install -y \
    clang \
    libclang-dev \
    libssl-dev \
    libcurl4-openssl-dev \
    librsvg2-dev \
    sqlite3 libsqlite3-dev \
    libhdf5-dev \
    pkg-config \
    wget \
    llvm-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/ \


RUN cargo install sccache

WORKDIR /home/root/rust