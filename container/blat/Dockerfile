FROM debian:12.11-slim

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.version="latest"

WORKDIR /home/root/blat
ARG PORT=1234
ARG STEPSIZE=5
ARG HGNUM="hg19"
ENV PORT=$PORT
ENV STEPSIZE=$STEPSIZE
ENV HGNUM=$HGNUM

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/blat/gfServer \
    && chmod +x gfServer

RUN mkdir -p ./genomes

EXPOSE $PORT

CMD ["sh", "-c", "./gfServer start 127.0.0.1 $PORT -stepSize=$STEPSIZE /home/root/blat/genomes/$HGNUM.2bit"]


