"""
diffSpliceCommon.py -- the code that diffSpliceEdgeR.py and diffSpliceLeafcutter.py share: the h5
reader, the sample and covariate input, the response rows, the stage timings and the JSON boundary.

Not a script of its own. Both scripts import it inside their import guard, after they cap the
BLAS/OpenMP threads, so numpy is already loaded with that cap when this module imports it.
"""

import json
import os
import sys
import tempfile
import traceback
from collections import Counter
from timeit import default_timer as timer

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------------------
# The h5 reader and the sample input
# --------------------------------------------------------------------------------------

def get_intron_meta(introns):
    """ Make a data.frame of meta data about the introns
    
    introns Names of the introns
    Returns: Data.frame with chr, start, end, cluster_name
    """
    intron_meta = pd.Series(introns).str.split(":", expand = True)
    if intron_meta.shape[1] == 4:
        intron_meta.columns = ['chr', 'start', 'end', 'cluster']
    elif intron_meta.shape[1] == 5:
        intron_meta.columns = ['chr', 'start', 'end', 'cluster', 'annotation']
    return intron_meta


def _load_into_memory(path):
    """
    Reopen a store with HDF5's in-memory driver, so every later read is served from this
    process's own RAM.

    On a shared filesystem a strided read costs far more than reading everything: measured on
    GPFS for a 0.92 GB / 2525-sample cohort, `cat` ran at 42-85 MB/s while h5py's 186
    per-sample reads of the 67 MB actually wanted took 235 s. Warming the OS page cache first
    was not enough -- 0.92 GB did not stay resident, and the reads still spent ~33 s waiting.
    Holding the image in the process removes the dependency on the page cache entirely; it
    costs one sequential pass plus `size` bytes of RAM.
    """
    import h5py
    return h5py.File(path, "r", driver="core", backing_store=False)


def read_h5_samples(h5_path, sample_names, row_ranges=None, prefetch="auto"):
    """
    Read the given samples out of the HDF5 store.

    Returns (buf, intron_ids, cluster_ids, cluster_starts) where buf is [samples x introns].
    Samples are read one row at a time: handing h5py a list of indices instead builds a
    union of hyperslabs and is dramatically slower for the same bytes (measured 0.4s vs 3.9s
    on a 927k x 200 store).
    """
    import h5py
    with h5py.File(h5_path, "r") as f:
        stored = [s.decode() if isinstance(s, bytes) else str(s) for s in f["samples"][:]]
        pos = {s: i for i, s in enumerate(stored)}
        missing = [s for s in sample_names if s not in pos]
        if missing:
            raise KeyError(f"{len(missing)} sample(s) not in {h5_path}, e.g. {missing[:5]}")
        cols = [pos[s] for s in sample_names]

        d = f["X"]
        # files built before the layout attribute existed are introns x samples
        layout = f.attrs.get("layout", "introns_x_samples")
        if isinstance(layout, bytes):
            layout = layout.decode()
        transposed = (layout == "samples_x_introns")
        n_all = d.shape[1] if transposed else d.shape[0]
        n_all_samples = d.shape[0] if transposed else d.shape[1]

        if row_ranges is None:
            keep = None
            n_introns = n_all
        else:
            # only the introns of the requested clusters -- makes gene drill-down sub-second
            keep = np.concatenate([np.arange(a, b) for a, b in row_ranges])
            n_introns = len(keep)

        # A sample's chunks are adjacent on disk but different samples are not, so 186 of
        # 2525 samples means 186 reads scattered over the file. They cost the same bytes in
        # any order, but issuing them in increasing sample index walks the file forwards,
        # which is the only pattern a shared filesystem's readahead can help with.
        read_order = np.argsort(cols, kind="stable")

        size = os.path.getsize(h5_path)
        if prefetch == "auto":
            # Skip it for the metadata-only calls, for stores too big to hold in RAM
            # alongside the result, and when nearly every sample is wanted (the loop below is
            # then already one forward pass). Note this does NOT depend on row_ranges: the
            # reads below pull whole sample rows either way, so a --gene or --chrom subset
            # pays exactly the same scattered-read cost that the load is there to avoid.
            prefetch = (len(cols) >= 8 and size <= 8e9
                        and len(cols) < 0.8 * n_all_samples)
        mem = None
        if prefetch:
            t_pf = timer()
            mem = _load_into_memory(h5_path)
            d = mem["X"]
            print(f"  loaded {size/1e9:.2f} GB into memory ({len(cols)} of {n_all_samples} "
                  f"samples wanted, so reading in place would be scattered) "
                  f"[{timer()-t_pf:.1f}s]")

        buf = np.empty((len(cols), n_introns), dtype=d.dtype)
        # Legacy introns x samples stores put a sample's chunks n_samples chunks apart, so a
        # per-sample d[:, j] is one scattered read per chunk per sample. Reading whole
        # chunk-row blocks instead makes every read sequential -- but it decompresses ALL
        # n_samples columns, so it only pays when the caller wants most of them. On a
        # 2525-sample cohort asked for 186 samples that is a 13.6x amplification, and it
        # measured 3x SLOWER on GPFS than the scattered reads (414s vs 132s). Rebuilding
        # with `build` is what actually fixes such a file.
        if not transposed:
            print(f"  note: {os.path.basename(h5_path)} has the legacy introns x samples "
                  f"layout; rebuild it with `build` to make each sample contiguous on disk")
        if transposed:
            # each sample is one contiguous run of chunks: read it in one go
            for k in read_order:
                col = d[cols[k], :]
                buf[k, :] = col if keep is None else col[keep]
        elif keep is None and d.shape[1] / max(1, len(cols)) <= 3:
            cr = d.chunks[0] if d.chunks else max(1, 2 ** 18)
            per_read = max(1, int(2e9 // max(1, cr * d.shape[1] * d.dtype.itemsize)))
            step = cr * per_read
            take = np.asarray(cols)
            for i0 in range(0, n_introns, step):
                i1 = min(i0 + step, n_introns)
                buf[:, i0:i1] = d[i0:i1, :][:, take].T
        else:
            # few enough samples (or few enough introns, on a gene drill-down) that paying
            # the seeks beats decompressing everything
            for k in read_order:
                col = d[:, cols[k]]
                buf[k, :] = col if keep is None else col[keep]

        if mem is not None:
            mem.close()

        all_ids = np.array([s.decode() if isinstance(s, bytes) else str(s)
                            for s in f["intron_ids"][:]])
        intron_ids = all_ids if keep is None else all_ids[keep]
        cluster_ids = np.array([s.decode() if isinstance(s, bytes) else str(s)
                                for s in f["cluster_ids"][:]])
        cluster_starts = f["cluster_starts"][:]
        if "cluster_genes" in f:
            cluster_genes = np.array([s.decode() if isinstance(s, bytes) else str(s)
                                      for s in f["cluster_genes"][:]])
        else:
            cluster_genes = np.array([""] * len(cluster_ids))
    return buf, intron_ids, cluster_ids, cluster_starts, cluster_genes


def _available_cpus():
    """CPUs this process may actually use -- respects SLURM/cgroup affinity, unlike cpu_count()."""
    try:
        return len(os.sched_getaffinity(0))   # Linux
    except AttributeError:
        return os.cpu_count() or 1


def _read_sample_list(path):
    """A path to a one-name-per-line file, or an already-materialised list of names."""
    if isinstance(path, (list, tuple)):
        names = [str(s).split()[0] for s in path if str(s).strip()]
    else:
        with open(path) as f:
            names = [ln.split()[0] for ln in f
                     if ln.strip() and not ln.lstrip().startswith('#')]
    if not names:
        raise ValueError(f"{path} contains no sample names")
    dup = [s for s, n in Counter(names).items() if n > 1]
    if dup:
        raise ValueError(f"{path} lists duplicate samples: {dup[:5]}")
    return names


def _encode_covariates(path, samples):
    """Whitespace-delimited, no header: column 0 is the sample name, the rest are covariates.
    Numeric columns are standardized, non-numeric are one-hot encoded (first level dropped)."""
    from sklearn.preprocessing import StandardScaler, OneHotEncoder
    from sklearn.compose import ColumnTransformer

    def _onehot():
        # sklearn renamed this keyword in 1.2 (sparse -> sparse_output)
        try:
            return OneHotEncoder(drop='first', sparse_output=False)
        except TypeError:
            return OneHotEncoder(drop='first', sparse=False)

    if isinstance(path, dict):
        # {sample: {name: value}} or {sample: [values]} -- the shape a portal has on hand
        cov = pd.DataFrame.from_dict(path, orient="index")
    else:
        cov = pd.read_table(path, header=None, sep=r'\s+')
        cov = cov.set_index(cov.columns[0])
    cov.columns = [str(c) for c in cov.columns]
    missing = [s for s in samples if s not in cov.index]
    if missing:
        raise KeyError(f"{len(missing)} sample(s) missing from {path}, e.g. {missing[:5]}")
    cov = cov.loc[samples]

    transformations = []
    for col in cov.columns:
        if pd.api.types.is_numeric_dtype(cov[col]):
            transformations.append((col, StandardScaler(), [col]))
        else:
            transformations.append((col, _onehot(), [col]))
    out = ColumnTransformer(transformations).fit_transform(cov)
    out = pd.DataFrame(out).reset_index(drop=True)  # positional, aligned with `samples`
    if out.isna().any().any():
        raise ValueError(f"{path} has missing values for the selected samples")
    return out


# --------------------------------------------------------------------------------------
# The response: timings, the row format, and the JSON boundary
# --------------------------------------------------------------------------------------

class StageTimes:
    """Elapsed seconds per stage, returned as `timings` in the response for the route to log."""

    def __init__(self, load_seconds):
        self.load_seconds = load_seconds
        self.seconds = {"load_packages": round(load_seconds, 2)}
        self.start = self.last = timer()

    def mark(self, stage):
        """Record the time since the previous mark as this stage."""
        now = timer()
        self.seconds[stage] = round(now - self.last, 2)
        self.last = now

    def report(self):
        return {**self.seconds, "total": round(self.load_seconds + self.last - self.start, 2)}


class _CapturedIO:
    """Swallow everything the pipeline writes while keeping a private channel for the
    response.

    Both fds move, not just stderr: the analysis prints progress to STDOUT, which would
    land in front of the JSON the route parses. fd 1 is duplicated first so the response
    still has somewhere to go, then fd 1 and fd 2 both point at a temp file for the
    duration -- at the descriptor level, so output from R, from spawned workers, and from
    C/C++ below the Python layer is caught too. Those are what would otherwise reach
    run_python and turn a successful run into a rejection.
    """

    def __enter__(self):
        self._buf = tempfile.TemporaryFile(mode="w+b")
        self.response = os.fdopen(os.dup(1), "w")      # the real stdout, kept aside
        self._saved = (os.dup(1), os.dup(2))
        sys.stdout.flush()
        sys.stderr.flush()
        os.dup2(self._buf.fileno(), 1)
        os.dup2(self._buf.fileno(), 2)
        self._py = (sys.stdout, sys.stderr)
        sys.stdout = open(os.devnull, "w")
        sys.stderr = open(os.devnull, "w")
        return self

    def tail(self, limit=4000):
        try:
            self._buf.flush()
            self._buf.seek(0)
            data = self._buf.read().decode("utf-8", "replace").strip()
        except Exception:
            return ""
        return data[-limit:] if len(data) > limit else data

    def __exit__(self, *exc):
        for f in (sys.stdout, sys.stderr):
            try:
                f.close()
            except Exception:
                pass
        sys.stdout, sys.stderr = self._py
        out_fd, err_fd = self._saved
        os.dup2(out_fd, 1)
        os.close(out_fd)
        os.dup2(err_fd, 2)
        os.close(err_fd)
        return False

    def close(self):
        self._buf.close()


def cluster_rows(df, name1, name2):
    """Cluster table -> DiffSpliceEntry rows.

    `df` needs cluster, genes, n_junc, p, fdr, deltapsi, top_intron, psi_<name1>,
    psi_<name2>, chr, start, stop.
    """
    def num(v, default=None):
        if v is None:
            return default
        try:
            f = float(v)
        except (TypeError, ValueError):
            return default
        return default if not np.isfinite(f) else f

    def txt(v):
        return "" if v is None or (isinstance(v, float) and not np.isfinite(v)) else str(v)

    rows = []
    for r in df.to_dict(orient="records"):
        p = num(r.get("p"))
        fdr = num(r.get("fdr"), p)
        dpsi = num(r.get("deltapsi"), 0.0)
        if p is None:
            continue                       # untested: it belongs in `skipped`, not here
        cid = txt(r.get("cluster"))
        genes = txt(r.get("genes"))
        row = {
            # --- DataEntry ---
            "adjusted_p_value": fdr,
            "original_p_value": p,
            # the volcano's x axis and the unit foldChangeCutoff is read in
            "fold_change": dpsi,
            "gene_id": cid,
            # never empty: getGenesColor throws without it
            "gene_name": genes or cid,
            # --- DiffSpliceEntry ---
            "cluster_id": cid,
            "genes": genes,
            "n_junc": int(num(r.get("n_junc"), 0)),
            "delta_psi": dpsi,
            "top_intron": txt(r.get("top_intron")),
            "psi_control": num(r.get(f"psi_{name1}"), 0.0),
            "psi_case": num(r.get(f"psi_{name2}"), 0.0),
            "chr": txt(r.get("chr")),
            "start": int(num(r.get("start"), 0)),
            "stop": int(num(r.get("stop"), 0)),
        }
        rows.append(row)
    return rows


def main(handler):
    """Read one JSON object from stdin, write one JSON object to stdout, nothing else.

    Always exits 0 with a JSON body: run_python treats a non-zero exit as a hard failure
    and discards the response, so a rejected request has to come back as data.
    """
    cap = _CapturedIO()
    try:
        with cap:
            try:
                raw = sys.__stdin__.read()
                if not raw.strip():
                    raise ValueError("empty request: expected one JSON object on stdin")
                req = json.loads(raw)
                if not isinstance(req, dict):
                    raise ValueError(
                        f"request must be a JSON object, got {type(req).__name__}")
                body = handler(req)
                body.setdefault("ok", True)
            except Exception as e:           # noqa: BLE001 -- this is the boundary
                detail = cap.tail()
                body = {"ok": False,
                        "error": f"{type(e).__name__}: {e}",
                        "traceback": traceback.format_exc()[-4000:],
                        "cluster_data": [], "num_controls": 0, "num_cases": 0,
                        "skipped": {}}
                if detail:
                    body["stderr"] = detail
            out = cap.response
            json.dump(body, out)
            out.write("\n")
            out.flush()
            out.close()
    finally:
        cap.close()
    return 0
