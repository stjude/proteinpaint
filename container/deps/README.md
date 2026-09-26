# Dependencies Image

The `Dockerfile` in this dir builds the images that have the system, R, Python, and Node dependencies
of ProteinPaint, which the release images in `container/server` and `container/full` build on:

| Target (image) | Contents |
|---|---|
| `ppbase` | the OS, R, Python, Node, htslib/samtools/bcftools, and tools such as `straw` and `gfClient` |
| `ppserver` | `ppbase` + the `@sjcrh/proteinpaint-server` package and `app-server.mjs` |
| `ppfull` | `ppserver` + the `@sjcrh/proteinpaint-front` package, `app-full.mjs`, and `container/public` |

`ppserver` and `ppfull` run as the unprivileged `app` user (UID/GID 1000), while `ppbase` runs as root.
With rootless podman, map the host account to that user with `--userns=keep-id:uid=1000,gid=1000`,
as `container/run.sh` does.

A new deps image is needed when a system, R, or Python dependency changes, or when the
`deps/Dockerfile` changes. A routine release only rebuilds the `server` and `full` images on top of
the deps image version that is set as `ARG VERSION` in `container/server/Dockerfile` and
`container/full/Dockerfile`.


## Publishing (CI)

The `CD-publish-deps-image` workflow runs on a manual dispatch, or on a push to the `deps-image` branch.
It packs the local workspaces (`container/pack.sh`), sets the versions (`deps/version.sh`), builds the
3 images (`deps/build.sh -m ghcr.io/stjude/`), runs the integration tests against `ppserver`, pushes the
images to ghcr.io, and then commits the new deps version to `ARG VERSION` in the `server` and `full`
Dockerfiles (`container/update_deps_version.sh`).

`container/build2.sh`, as called in a release, fails early with `container/check_base_user.sh` when
the `ARG VERSION` deps image still runs as root, since the `server` and `full` Dockerfiles expect a
non-root base image.


## Building locally

Prerequisites: Docker Desktop (or another Docker-compatible runtime with `buildx`), running with enough
disk space (the images are ~6GB), and a checkout of this repo. On an arm64 machine, such as an M-series
Mac, the images are built for `linux/amd64` under emulation, which makes the R package install slow.

```bash
cd proteinpaint/container

# optional: use the local server code instead of the published server package version,
# the tarball name must match the server/package.json version
(cd ../server && npm pack --pack-destination ../container/tmppack)

./deps/build.sh
```

`deps/build.sh` may be called from any dir. It stages the files that the `Dockerfile` copies in a
temporary build context dir, which is removed whether the build succeeds, fails, or is interrupted, so
it does not add or change any file in the repo. Only the tracked files in `container/public` are copied,
so local leftovers there are not included in the image.

The versions are read from `deps/package.json` when `deps/version.sh` has set them, as in CI, and are
otherwise the same versions that `version.sh` would set: the root `package.json` version for the image,
and the `server` and `front` package versions to install. A `sjcrh-proteinpaint-server-<version>.tgz`
tarball in `deps/tmppack` or `container/tmppack` is installed instead of the published server package.
Note that `container/pack.sh` also creates these tarballs, but it only packs the workspaces that changed
since the last publish, and it modifies tracked `package.json` files that must be restored afterwards.

The built images are tagged `ppbase:latest`, `ppserver:latest`, and `ppfull:latest`. To verify:

```bash
docker image inspect ppserver:latest ppfull:latest --format '{{.RepoTags}} user={{.Config.User}}'
```

### Running a local build

The `ppfull` (or `ppserver`) image is a complete app, so it can be run directly. From
`proteinpaint/container`, with a `serverconfig.json` in that dir:

```bash
./run.sh ppfull:latest
```

`run.sh` mounts the `serverconfig.json` `tpmasterdir`, and the `container/dataset` dir as the app's
`dataset` dir, so that a dataset file can be tested without rebuilding the image.

#### Example: testing the GDC-GRIN2 dataset

Generate the dataset from the `sjpp` root, and copy the whole compiled folder, since its entry file
still requires its sibling modules (esbuild runs without `--bundle`):

```bash
cd sjpp
npm run cjs
cp -r dataset/cjs/gdc proteinpaint/container/dataset/
```

Then add the dataset to the `serverconfig.json` in `proteinpaint/container`, and start `./run.sh ppfull:latest`.


## Updating pinned dependencies

The base image, `r-base`, tracks Debian testing/sid, so some packages are pinned in the `Dockerfile`
to fail the build on a version drift, instead of at runtime. See the comments next to each pin.

- **Python** (`python3`, `python3-dev`, `python3-venv`, `python3-pip`): the pinned versions rotate out
  of the Debian archive, which fails the `apt-get install` step with `Version '...' was not found`.
  Read the available versions, and re-pin them instead of removing the pins:
  ```bash
  docker run --rm --platform linux/amd64 r-base:4.5.0 bash -c \
    'apt-get update -qq >/dev/null 2>&1; apt-cache policy python3 python3-dev python3-venv python3-pip'
  ```
  A change of the Python minor version, such as 3.14 to 3.15, may also require updating
  `python/requirements.txt`.
- **HDF5** (`libhdf5-310`): must match the HDF5 soname that the rust binaries link against, which are
  compiled in `container/rust/Dockerfile`. The `ppserverdeps` stage fails the build when a rust binary
  cannot load its shared libraries.
- **libdatrie1** (with `--allow-downgrades`): pinned for a package conflict in the base image.
- **R packages**: listed in `R/utils/cran.pkgs.txt` and `R/utils/bioconductor.pkgs.txt`, and installed
  by `R/utils/install.pkgs.R`.

After a deps image is published, `container/update_deps_version.sh <version> <Dockerfile>` sets its
version in the `server` and `full` Dockerfiles, which CI does automatically.


## Troubleshooting

- **Network errors during `apt-get`, `pip`, or `npm` steps**: disable a VPN or proxy that intercepts
  TLS, such as Cloudflare WARP, and retry.
- **`Version '...' was not found` in the `apt-get install` step**: re-pin the version, see above.
- **Out of disk space**: remove unused images and build cache with `docker system prune` (and
  `docker builder prune`), after checking what would be removed.
- **Debugging a failed step**: temporarily add `CMD ["sleep", "3600"]` after the last successful step,
  build that stage with `--target`, run it, and use `docker exec -it <container> bash` to run the
  failing command. See also the `Container Development` section in `container/README.md`.
