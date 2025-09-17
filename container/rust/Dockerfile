FROM debian:testing

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.version="latest"

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
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
    build-essential \
    ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install Rust with rustup and set default toolchain
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain 1.89.0 && \
    . "$HOME/.cargo/env" && \
    rustup default 1.89.0

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Optional: install Rust tool
RUN cargo install sccache

WORKDIR /home/root/rust
