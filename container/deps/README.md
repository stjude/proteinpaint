# Dependencies Image

The `Dockerfile` in this dir builds the images that have the system, R, Python, and Node dependencies
of ProteinPaint, which the release images in `container/server` and `container/full` build on:

| Target (image) | Contents |
|---|---|
| `ppbase` | the OS (Debian trixie), the build toolchain, R, Python, Node and npm, and tools such as `straw` and `gfClient` |
| `ppdepsruntime` (the `ppruntime` stage) | the runtime libraries and the same R, Python, Node and tool files as `ppbase`, without the app |
| `ppserver` | `ppdepsruntime` + the `@sjcrh/proteinpaint-server` package and `app-server.mjs` |
| `ppfull` | `ppserver` + the `@sjcrh/proteinpaint-front` package, `app-full.mjs`, and `container/public` |

`ppdepsruntime`, `ppserver`, and `ppfull` have no build toolchain, `-dev` packages, or npm: the app is installed on
`ppbase`, in the `ppserverdeps` and `ppfulldeps` stages, and copied into `ppserver`/`ppfull`. The `server` and `full`
Dockerfiles build on `ppdepsruntime`, instead of on `ppserver`/`ppfull`, so that they do not ship the app layer that
`ppserver`/`ppfull` already has twice: once hidden by a later whiteout, and once replaced with the current app code.
They likewise install the app with npm in a stage on the official `node` image. `ppbase` keeps the toolchain, for
the sjpp dev container.

`ppdepsruntime`, `ppserver`, and `ppfull` run as the unprivileged `app` user (UID/GID 1000), while `ppbase` runs as root.
The app files under `/home/root/pp/app/active`, including `node_modules` and, in `ppfull`, the client bundle in
`bin/` and `public/`, are owned by root and only read by the `app` user. The `ppfull` client bundle is generated at
build time, so nothing under the app dir is written at runtime, except to a dir that a deployment mounts there.
With rootless podman, map the host account to that user with `--userns=keep-id:uid=1000,gid=1000`,
as `container/run.sh` does.

Another UID may also run these images, such as the owner of the bind-mounted data files, with
`docker run --user <uid>:0` (or a Kubernetes `runAsUser` with `runAsGroup: 0`). A runtime assigns
group 0 to a UID that has no account in the image, and the dirs that the app writes at runtime, such as
the cache dir and `HOME=/home/app`, are writable for group 0. Do not use another group ID, since the app
could not write those dirs.

A new deps image is needed when a system, R, or Python dependency changes, or when the
`deps/Dockerfile` changes. A routine release only rebuilds the `server` and `full` images on top of
the deps image version that is set as `ARG VERSION` in `container/server/Dockerfile` and
`container/full/Dockerfile`.


## Publishing (CI)

The `CD-publish-deps-image` workflow runs on a manual dispatch, or on a push to the `deps-image` branch.
It packs the local workspaces (`container/pack.sh`), sets the versions (`deps/version.sh`), builds the
4 images (`deps/build.sh -m ghcr.io/stjude/`), runs the integration tests against `ppserver`, pushes the
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

# pack the workspace tarballs that the images install, since the workspace packages other than
# the client are not published to the npm registry
./pack.sh
# pack.sh points the dependencies in these tracked files to the tarballs, restore them
git restore server/package.json full/package.json

./deps/build.sh
```

`deps/build.sh` may be called from any dir. It stages the `Dockerfile`, and the files that it copies,
in a temporary build context dir, which is removed whether the build succeeds, fails, or is interrupted,
so it does not add or change any file in the repo. All 3 image builds use these staged copies, so a
branch checkout during a long build does not affect it. Only the tracked files in `container/public` are copied,
so local leftovers there are not included in the image.

The versions are read from `deps/package.json` when `deps/version.sh` has set them, as in CI, and are
otherwise the same versions that `version.sh` would set: the root `package.json` version for the image,
and the `server` and `front` package versions to install. The `sjcrh-proteinpaint-server-<version>.tgz`
and `sjcrh-proteinpaint-front-<version>.tgz` tarballs in `deps/tmppack` or `container/tmppack` are installed
instead of the published packages. A version that is newer than the last published one is only available
as a tarball, so run `container/pack.sh` first, as above. It packs every workspace that the images install,
whether or not it has changed. Do not use its server-only `-s` option here, since it skips the front
tarball that the `ppfull` image installs. It modifies tracked `package.json` files that must be restored
afterwards.

The built images are tagged `ppbase:latest`, `ppdepsruntime:latest`, `ppserver:latest`, and `ppfull:latest`. To verify:

```bash
docker image inspect ppdepsruntime:latest ppserver:latest ppfull:latest --format '{{.RepoTags}} user={{.Config.User}}'
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


## Base image and build cache

The images are based on Debian stable (`debian:trixie-slim`), which the Debian security team supports,
with R from the trixie packages. Before, the base image was `r-base`, which tracks Debian testing/sid, where
an apt update could move python3 or the HDF5 soname under the image. The rust binaries are also compiled on trixie, in `container/rust/Dockerfile`.

The `Dockerfile` stages are ordered and split so that the slow steps are rebuilt only when their inputs change:

| Stage | Contents | Rebuilt when |
|---|---|---|
| `os` | the apt system libs, build toolchain, R, and python3 | the pinned base image or the apt package list changes |
| `rlib` | the R packages, CRAN binaries from the Posit Package Manager, and the compiled Bioconductor packages | `R/utils` changes |
| `py` | the python venv | `python/requirements.txt` changes |
| `tools` | `straw` and `gfClient` | the download list changes |
| `ppbase` | copies the above, the node install from the official `node` image, and applies the Debian security updates | every day, which is a fast step |
| `osruntime` | the apt runtime libraries, R, python3, and `h5dump`, without the toolchain and `-dev` packages | the pinned base image or its apt package list changes |
| `ppruntime` | copies the same files as `ppbase` onto `osruntime`, applies the Debian security updates, and checks that every binary and module resolves its shared libraries (`checkSharedLibs.sh`) | every day, which is a fast step |

The `rlib`, `py`, and `tools` stages only depend on `os`, and `osruntime` on the base image, so they are built in parallel. In CI, the cache
of every stage is saved to `ghcr.io/stjude/ppbase:buildcache` (`PPDEPS_CACHE_REF` in `deps/build.sh`), so that
a runner without a local cache reuses the last build's layers.

### Updating the base images

The `debian` and `node` base images are pinned by digest, as `DEBIAN_IMAGE` and `NODE_IMAGE` at the top of
the `Dockerfile`, so that the tag moving to a new digest does not invalidate every cached layer. The
security updates since the pinned digest are applied in the `ppbase` `apt-get upgrade` step. Bump the
digests periodically, such as monthly, or for a node version change, which rebuilds every stage:

```bash
docker buildx imagetools inspect debian:trixie-slim --format '{{json .Manifest.Digest}}'
docker buildx imagetools inspect node:24.22.1-trixie-slim --format '{{json .Manifest.Digest}}'
```

The `node` image must be on the same Debian release as the `debian` image. A move to the next Debian
release must also update `container/rust/Dockerfile`, so that the rust binaries link the same HDF5 soname.

### Pinned dependencies

- **Python**: not pinned, since Debian stable keeps python3 at 3.13 for the life of trixie, and a version pin
  would fail the build at each security update. The python packages are pinned in `python/requirements.txt`.
- **HDF5** (`libhdf5-310`): must match the HDF5 soname that the rust binaries link against, which are
  compiled in `container/rust/Dockerfile`. The `ppserver` and `ppfull` stages fail the build when a rust
  binary cannot load its shared libraries. A library that a new R or python package needs at runtime must also be
  added to the `osruntime` apt list, which the `ppruntime` check reports by file name.
- **R packages**: listed in `R/utils/cran.pkgs.txt` and `R/utils/bioconductor.pkgs.txt`, and installed
  by `R/utils/install.pkgs.R`. To use another CRAN mirror, such as a dated P3M snapshot for a reproducible
  build, set the `CRAN_REPO` build arg, for example `-b "--build-arg CRAN_REPO=https://p3m.dev/cran/__linux__/trixie/2026-10-01"`.

After a deps image is published, `container/update_deps_version.sh <version> <Dockerfile>` sets its
version in the `server` and `full` Dockerfiles, which CI does automatically.


## Troubleshooting

- **Network errors during `apt-get`, `pip`, or `npm` steps**: disable a VPN or proxy that intercepts
  TLS, such as Cloudflare WARP, and retry.
- **Out of disk space**: remove unused images and build cache with `docker system prune` (and
  `docker builder prune`), after checking what would be removed.
- **Debugging a failed step**: temporarily add `CMD ["sleep", "3600"]` after the last successful step,
  build that stage with `--target`, run it, and use `docker exec -it <container> bash` to run the
  failing command. See also the `Container Development` section in `container/README.md`.
