# GDC-GRIN2 Dependencies Image Build Guide

This guide walks you through building a new dependencies image for the GDC-GRIN2 project.

## Prerequisites

- Docker Desktop installed and running
- Access to the `sjpp` and `proteinpaint` repositories
- WARP disabled (see step 4)

## Build Process

### 1. Generate Dataset File

Navigate to the `sjpp` root directory and generate a new hg38 dataset:

```bash
cd sjpp
npm run cjs
```

### 2. Copy Dataset to Container

Copy the generated dataset file to the proteinpaint container:

```bash
cp dataset/cjs/gdc.hg38.js proteinpaint/container/dataset/
```

### 3. Prepare Dependencies Directory

Create a temporary packaging directory:

```bash
cd proteinpaint/container/deps
mkdir tmppack
```

### 4. Disable WARP

**Important:** Ensure WARP is turned off before proceeding.

### 5. Version and Build Dependencies

Generate version information and build the dependencies:

```bash
# Still in proteinpaint/container/deps
./version.sh deps
./build.sh
```

### 6. Configure Full Container

Navigate to the full container directory:

```bash
cd proteinpaint/container/full/
```

**Configure Dockerfile:**

- Open `Dockerfile` in your editor
- Verify the configuration matches the requirements outlined in [the documentation](https://github.com/stjude/proteinpaint/wiki/Buiding-a-deps-image)
- Look for the section titled "The new deps image version named 'ppfull:latest' should be added to proteinpaint/container/full/Dockerfile:" and ensure your file matches

### 7. Create Server Configuration

Ensure you have a minimal `serverconfig.json` file in `proteinpaint/container/`.

### 8. Clean Docker Environment

Open Docker Desktop and manually remove all previous builds and images to avoid conflicts.

### 9. Build and Run

Execute the final build and run commands:

```bash
cd container
./pack.sh
./build2.sh -z full
./run.sh ppfull:NEW_VERSION
```

**Note:** Replace `NEW_VERSION` with the actual version number from your Docker images list. This step requires the `serverconfig.json` file created in step 7.

## Troubleshooting

- Ensure all paths are correct relative to your project structure
- Verify Docker Desktop is running and has sufficient resources
- Check that WARP is disabled before building
- Confirm the `serverconfig.json` file exists and is properly formatted

## Next Steps

After successful completion, your image can be tested
