# Must stay on a base whose libhdf5-dev is 1.14.x. hdf5-metno 0.9 hardcodes the accepted HDF5
# versions (build.rs: `^(1)\.(8|10|12|14)\.`) and panics with `Invalid H5_VERSION` on anything 2.x.
# Do NOT "align" this with the runtime image (r-base, in container/deps/Dockerfile): r-base tracks
# Debian sid/testing and installs HDF5 2.x, which this crate cannot compile against at all.
# The two images are matched at the *soname* instead -- deps installs libhdf5-310 so the runtime
# carries the .310 these binaries link. See the comment there before changing either.
FROM debian:trixie

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.version="latest"

# Define an argument with a rust version value, this will be defined in the build script 
ARG rust_version=1 # Default value, will be overwritten during run-time of the build script

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
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain $rust_version && \
    . "$HOME/.cargo/env" && \
    rustup default $rust_version

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Optional: install Rust tool
RUN cargo install sccache

WORKDIR /home/root/rust
