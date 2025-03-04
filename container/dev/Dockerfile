FROM ghcr.io/stjude/ppbase:latest

ARG IMGREV=""
ARG IMGVER=""

LABEL org.opencontainers.image.source="https://github.com/stjude/proteinpaint" \
    org.opencontainers.image.revision="$IMGREV" \
    org.opencontainers.image.version="$IMGVER"

# Install pre-commit using pip3
RUN pip3 install pre-commit

WORKDIR /home/root/proteinpaint/

EXPOSE 3000
CMD ["sh", "-c", "npm install && npm run build && npm run dev1"]

