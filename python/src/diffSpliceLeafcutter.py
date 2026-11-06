"""
diffSpliceLeafcutter.py -- genome-wide leafcutter differential splicing for the volcano.

    run_python('diffSpliceLeafcutter.py', JSON.stringify(req))

The Dirichlet-multinomial likelihood-ratio test over every testable cluster. 
The requests, h5 reader, filter thresholds and row format match with diffSpliceEdgeR.py , 
so that both test the same clusters and return the same rows: a change to one of these has to be made in both.


REQUEST
    {
      "h5":       "/path/cohort.h5",            required
      "group1":   ["s1", ...],                  required -- the CONTROL group
      "group2":   ["s3", ...],                  required -- the CASE group
      "covariates": {"s1": {"batch": "A"}, ...} default null (a path also works)
      "min_coverage":           20,
      "min_samples_per_intron":  5,
      "min_samples_per_group":   3,
      "max_cluster_size":     null,             null = no cap
      "threads":                 8,             clamped to available CPUs, and to 1 for fewer
                                                than 2000 clusters: a worker costs seconds to start
      "top":                  null              keep only the N best-ranked clusters
    }

RESPONSE
    { "ok": true, "cluster_data": [DiffSpliceEntry...],
      "junctions_by_cluster": {cluster_id: [[start, stop, null, psi_control, psi_case]...]},
      "num_controls": N, "num_cases": M, "skipped": {reason: count},
      "n_clusters_tested": 20906, "n_significant_fdr05": 7508, "truncated": false }

    When no cluster survives filtering the body is still ok, with "status": "no_clusters", an
    empty cluster_data, and the reasons in `skipped`.

The test is per cluster, so a junction has no p of its own: its p in junctions_by_cluster is
null, not the cluster's. 
"""

import warnings

warnings.filterwarnings("ignore")

import json
import os
import sys

# Cap BLAS/OpenMP threads BEFORE numpy loads: these pools are sized at import time, so
# setting them afterwards is a no-op. Without the cap every worker process starts its own
# multi-threaded BLAS and they oversubscribe the machine, making a larger thread count
# SLOWER than a small one.
for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
           "BLIS_NUM_THREADS", "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ.setdefault(_v, "1")

# Everything below is guarded: run_python discards the response on a non-zero exit, so a missing
# dependency has to come back as a JSON body that names the module.
try:
    import argparse
    import multiprocessing
    import tempfile
    import time
    import traceback
    from collections import Counter
    from functools import partial
    from timeit import default_timer as timer

    _t_load = timer()
    import numpy as np
    import pandas as pd
    import scipy.stats
    from scipy.stats import false_discovery_control
    import torch

    # Pinned here, at import, not later: PyTorch sizes the pool on the first parallel op and a
    # set_num_threads() after that is a no-op, which would leave the parent on a different
    # thread count from its workers. That changes float32 reduction order, and LBFGS amplifies
    # it into visibly different fits.
    torch.set_num_threads(1)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        pass          # already fixed by an earlier parallel region; nothing to do
    _load_seconds = timer() - _t_load

except Exception as _import_error:
    json.dump({"ok": False,
               "error": f"{type(_import_error).__name__}: {_import_error}",
               "error_type": "environment",
               "cluster_data": [], "num_controls": 0, "num_cases": 0, "skipped": {}},
              sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(0)


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


def cluster_rows(df, name1, name2, extras=None):
    """Cluster table -> DiffSpliceEntry rows.

    `df` needs cluster, genes, n_junc, p, fdr, deltapsi, top_intron, psi_<name1>,
    psi_<name2>, chr, start, stop. `extras` optionally maps a cluster id to the
    engine-specific `leafcutter` object.
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
        if extras and cid in extras:
            row["leafcutter"] = extras[cid]
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


# Below this many clusters the fit takes less time than starting workers, each of which has to
# import torch again.
MIN_CLUSTERS_FOR_WORKERS = 2000


# --------------------------------------------------------------------------------------
# From leafcutter_ds2_h5_batched.py: FDR and worker setup
# --------------------------------------------------------------------------------------

def robust_fdr(ps, method = "bh"):
    mask = ~np.isnan(ps)
    p_adjust = ps.copy()
    p_adjust[mask] = false_discovery_control(ps[mask], method = method)
    return p_adjust

def _init_worker():
    """Worker initializer for the multiprocessing Pool. Must be module-level so it can
    be pickled under the "spawn" start method (macOS/Windows default)."""
    # Limit PyTorch threads
    torch.set_num_threads(1)
    # Also limit numpy/scikit-learn BLAS threads (BayesianRidge uses these)
    # threadpoolctl is a dependency of scikit-learn
    from threadpoolctl import threadpool_limits
    threadpool_limits(1)

# --------------------------------------------------------------------------------------
# Batched engine: B clusters fitted in one set of tensor ops
# --------------------------------------------------------------------------------------
#
# The per-cluster problems here are tiny -- a 58 x 3 count matrix is typical -- so the
# unbatched code spends almost all of its time on PyTorch's fixed per-op cost (dispatch,
# autograd bookkeeping, allocation), which does not depend on tensor size. Measured on the
# Geuvadis example: 423 us per objective evaluation, of which ~12 us is arithmetic.
#
# Batching gives every tensor a leading cluster dimension, so one op serves B clusters and
# that fixed cost is divided by B. Measured 1.49 ms/cluster against 28 ms unbatched on a
# 56k-cluster run, single core -- and at that point the remaining time really is lgamma
# and digamma, i.e. the same floor a C or Rust rewrite would hit.
#
# Two things make the batching exact rather than an approximation:
#
#   * a sample with zero coverage in a cluster contributes EXACTLY zero to the log joint
#     (lgamma(sa) + sum lgamma(a) - lgamma(sa) - sum lgamma(a) = 0 when y = 0), so the
#     per-cluster row filter is unnecessary -- every cluster keeps all N rows and the
#     design matrix is shared. The optimum is unchanged, not merely close;
#   * clusters are bucketed by J so shapes match within a batch. Padding the J axis would
#     NOT be free: softmax normalizes over J and conc enters the gamma prior, so a pad
#     column would change the likelihood.
#
# The cost that batching introduces is stragglers: LBFGS needs a different number of
# iterations per cluster, and a naive batch runs until the slowest one finishes. Left
# alone that costs 4x the function evaluations and gives most of the win back, so
# converged clusters are compacted out of the batch -- inside the line search as well as
# between iterations.

BATCHED_MAX_ITER = 500
BATCHED_HISTORY = 100


def _qr_basis(J, dtype, device):
    """A_qr [J x (J-1)]: DamCleverGuide's sum-to-zero basis, built once per J bucket."""
    A = torch.eye(J, dtype=dtype, device=device)
    A[-1, :-1] = -1.
    A[-1, -1] = 0.
    return torch.linalg.qr(A).Q[:, :-1]


def _unpack(theta, P, J, A_qr, conc_max):
    """theta [B x D] -> beta [B x P x J], conc [B x J], where D = P*(J-1) + J.

    This is the space LBFGS actually optimizes in the unbatched code: beta_raw is
    unconstrained and mapped through A_qr, and conc is the unconstrained value behind
    pyro's interval(0, conc_max) constraint, i.e. conc = conc_max * sigmoid(u).
    """
    B = theta.shape[0]
    nb = P * (J - 1)
    beta = theta[:, :nb].view(B, P, J - 1) @ A_qr.t()
    conc = conc_max * torch.sigmoid(theta[:, nb:])
    return beta, conc


def _batched_neg_log_joint(theta, x, y, y_sum, P, J, A_qr, conc_max, eps,
                           conc_shape, conc_rate, lgamma_shape):
    """[B] negative log joint. x [B x N x P], y [B x N x J], y_sum [B x N]."""
    beta, conc = _unpack(theta, P, J, A_qr, conc_max)
    a = (x @ beta).softmax(-1) * conc.unsqueeze(-2) + eps
    sa = a.sum(-1)
    ll = (sa.lgamma() + (a + y).lgamma().sum(-1)
          - (sa + y_sum).lgamma() - a.lgamma().sum(-1)).sum(-1)
    # Gamma(conc_shape, conc_rate) prior, independent across junctions
    lp = (conc_shape * np.log(conc_rate) - lgamma_shape
          + (conc_shape - 1.) * conc.log() - conc_rate * conc).sum(-1)
    return -(ll + lp)


def _make_fg(x, y, P, J, A_qr, conc_max, eps, conc_shape, conc_rate):
    """Returns fg(theta, rows) -> (loss, grad).

    `rows` says which clusters of the original batch `theta` currently holds, so the
    optimizer can compact converged clusters away without the data going out of step.
    One backward serves the whole batch: clusters are independent, so
    d(sum_b loss_b)/d(theta_b) is cluster b's own gradient.
    """
    y_sum = y.sum(-1)
    lgamma_shape = float(torch.lgamma(torch.tensor(float(conc_shape))))

    def fg(theta, rows=None):
        xs, ys, yss = (x, y, y_sum) if rows is None else (x[rows], y[rows], y_sum[rows])
        th = theta.detach().requires_grad_(True)
        loss = _batched_neg_log_joint(th, xs, ys, yss, P, J, A_qr, conc_max, eps,
                                      conc_shape, conc_rate, lgamma_shape)
        g, = torch.autograd.grad(loss.sum(), th)
        return loss.detach(), g
    return fg


def _batched_cubic_interpolate(x1, f1, g1, x2, f2, g2, bounds=None):
    """Vectorized clone of torch.optim.lbfgs._cubic_interpolate; every argument is [B]."""
    if bounds is not None:
        xmin_bound, xmax_bound = bounds
    else:
        xmin_bound = torch.minimum(x1, x2)
        xmax_bound = torch.maximum(x1, x2)
    dx = x1 - x2
    d1 = g1 + g2 - 3 * (f1 - f2) / torch.where(dx == 0, torch.full_like(dx, 1e-30), dx)
    d2_sq = d1 * d1 - g1 * g2
    ok = d2_sq >= 0
    d2 = d2_sq.clamp(min=0).sqrt()
    cond = x1 <= x2
    base = torch.where(cond, x2, x1)
    other = torch.where(cond, x1, x2)
    num = torch.where(cond, g2 + d2 - d1, g1 + d2 - d1)
    den = torch.where(cond, g2 - g1 + 2 * d2, g1 - g2 + 2 * d2)
    den = torch.where(den == 0, torch.full_like(den, 1e-30), den)
    res = base - (base - other) * (num / den)
    res = torch.minimum(torch.maximum(res, xmin_bound), xmax_bound)
    return torch.where(ok & torch.isfinite(res), res, (xmin_bound + xmax_bound) / 2.)


def _batched_strong_wolfe(obj_func, rows, x, t, d, f, g, gtd, c1=1e-4, c2=0.9,
                          tolerance_change=1e-9, max_ls=25):
    """Vectorized clone of _strong_wolfe: every cluster brackets and zooms independently.

    Each pass evaluates the objective only for clusters still searching, so a cluster that
    satisfies Wolfe on its first probe drops out immediately instead of riding along for
    the 25 iterations its slowest neighbour needs.
    """
    Bsz = x.shape[0]
    dev, dt = x.device, x.dtype
    d_norm = d.abs().max(-1).values

    def evaluate(live):
        lv = torch.nonzero(live).squeeze(-1)
        fl, gl = obj_func(x[lv], t[lv], d[lv], rows[lv])
        return lv, fl, gl

    f_new = torch.zeros(Bsz, device=dev, dtype=dt)
    g_new = torch.zeros(Bsz, x.shape[1], device=dev, dtype=dt)
    lv, fl, gl = evaluate(torch.ones(Bsz, dtype=torch.bool, device=dev))
    f_new[lv], g_new[lv] = fl, gl
    gtd_new = (g_new * d).sum(-1)
    n_evals = torch.ones(Bsz, device=dev, dtype=dt)

    t_prev = torch.zeros(Bsz, device=dev, dtype=dt)
    f_prev, g_prev, gtd_prev = f.clone(), g.clone(), gtd.clone()

    br_t = torch.zeros(Bsz, 2, device=dev, dtype=dt)
    br_f = torch.zeros(Bsz, 2, device=dev, dtype=dt)
    br_gtd = torch.zeros(Bsz, 2, device=dev, dtype=dt)
    br_g = torch.zeros(Bsz, 2, x.shape[1], device=dev, dtype=dt)

    done = torch.zeros(Bsz, dtype=torch.bool, device=dev)
    bracketed = torch.zeros(Bsz, dtype=torch.bool, device=dev)

    def set_bracket(m, t0, f0, g0, gtd0, t1, f1, g1, gtd1):
        br_t[m, 0], br_f[m, 0], br_gtd[m, 0], br_g[m, 0] = t0[m], f0[m], gtd0[m], g0[m]
        br_t[m, 1], br_f[m, 1], br_gtd[m, 1], br_g[m, 1] = t1[m], f1[m], gtd1[m], g1[m]

    # The budget is per cluster, so that a cluster's fit does not depend on others in its batch.
    ls_used = torch.zeros(Bsz, dtype=torch.long, device=dev)
    ls_iter = 0                                                 # the same for every cluster still bracketing
    while ls_iter < max_ls:                                     # phase 1: bracket
        live = ~(done | bracketed)
        if not live.any():
            break
        hit_hi = live & ((f_new > (f + c1 * t * gtd)) | ((ls_iter > 1) & (f_new >= f_prev)))
        if hit_hi.any():
            set_bracket(hit_hi, t_prev, f_prev, g_prev, gtd_prev, t, f_new, g_new, gtd_new)
            bracketed |= hit_hi
        live = ~(done | bracketed)
        wolfe = live & (gtd_new.abs() <= -c2 * gtd)
        if wolfe.any():
            set_bracket(wolfe, t, f_new, g_new, gtd_new, t, f_new, g_new, gtd_new)
            done |= wolfe
        live = ~(done | bracketed)
        pos = live & (gtd_new >= 0)
        if pos.any():
            set_bracket(pos, t, f_new, g_new, gtd_new, t_prev, f_prev, g_prev, gtd_prev)
            bracketed |= pos
        live = ~(done | bracketed)
        if not live.any():
            break

        tmp = t.clone()
        t_int = _batched_cubic_interpolate(t_prev, f_prev, gtd_prev, t, f_new, gtd_new,
                                           bounds=(t + 0.01 * (t - t_prev), t * 10))
        t = torch.where(live, t_int, t)
        t_prev = torch.where(live, tmp, t_prev)
        f_prev = torch.where(live, f_new, f_prev)
        gtd_prev = torch.where(live, gtd_new, gtd_prev)
        g_prev = torch.where(live.unsqueeze(-1), g_new, g_prev)

        lv, fl, gl = evaluate(live)
        f_new[lv], g_new[lv] = fl, gl
        n_evals[lv] += 1
        ls_used[lv] += 1
        gtd_new = (g_new * d).sum(-1)
        ls_iter += 1

    stale = ~(done | bracketed)                 # never bracketed within max_ls
    if stale.any():
        set_bracket(stale, torch.zeros_like(t), f, g, gtd, t, f_new, g_new, gtd_new)
        bracketed |= stale

    low = (br_f[:, 0] > br_f[:, 1]).long()
    high = 1 - low
    insuf = torch.zeros(Bsz, dtype=torch.bool, device=dev)
    ar = torch.arange(Bsz, device=dev)

    while True:                                                 # phase 2: zoom
        live = ~done & (ls_used < max_ls)
        done |= live & ((br_t[:, 1] - br_t[:, 0]).abs() * d_norm < tolerance_change)
        live = ~done & (ls_used < max_ls)
        if not live.any():
            break

        t_int = _batched_cubic_interpolate(br_t[:, 0], br_f[:, 0], br_gtd[:, 0],
                                            br_t[:, 1], br_f[:, 1], br_gtd[:, 1])
        bmax, bmin = br_t.max(-1).values, br_t.min(-1).values
        eps_b = 0.1 * (bmax - bmin)
        near_edge = torch.minimum(bmax - t_int, t_int - bmin) < eps_b
        force = insuf | (t_int >= bmax) | (t_int <= bmin)
        snap_hi = (t_int - bmax).abs() < (t_int - bmin).abs()
        t_new = torch.where(near_edge & force,
                            torch.where(snap_hi, bmax - eps_b, bmin + eps_b), t_int)
        insuf = near_edge & ~force
        t = torch.where(live, t_new, t)

        lv, fl, gl = evaluate(live)
        f_new[lv], g_new[lv] = fl, gl
        n_evals[lv] += 1
        ls_used[lv] += 1
        gtd_new = (g_new * d).sum(-1)

        worse = live & ((f_new > (f + c1 * t * gtd)) | (f_new >= br_f[ar, low]))
        if worse.any():
            idx, h = ar[worse], high[worse]
            br_t[idx, h], br_f[idx, h] = t[worse], f_new[worse]
            br_gtd[idx, h], br_g[idx, h] = gtd_new[worse], g_new[worse]
            nl = (br_f[idx, 0] > br_f[idx, 1]).long()
            low[idx], high[idx] = nl, 1 - nl
        better = live & ~worse
        if better.any():
            sat = better & (gtd_new.abs() <= -c2 * gtd)
            done |= sat
            flip = better & ~sat & (gtd_new * (br_t[ar, high] - br_t[ar, low]) >= 0)
            if flip.any():
                idx, h, l = ar[flip], high[flip], low[flip]
                br_t[idx, h], br_f[idx, h] = br_t[idx, l], br_f[idx, l]
                br_gtd[idx, h], br_g[idx, h] = br_gtd[idx, l], br_g[idx, l]
            idx, l = ar[better], low[better]
            br_t[idx, l], br_f[idx, l] = t[better], f_new[better]
            br_gtd[idx, l], br_g[idx, l] = gtd_new[better], g_new[better]

    return br_f[ar, low], br_g[ar, low], br_t[ar, low], n_evals


BATCHED_EXIT = {
    0: "Reached maximum # iterations",
    1: "Converged (line search optimality condition)",
    2: "Converged (lack of progress)",
    3: "Converged (loss change below tolerance)",
    4: "Converged (directional derivative < tolerance_change)",
    5: "max|grad| < tolerance_grad at init",
}


def _batched_lbfgs(theta, fg, lr=1.0, max_iter=BATCHED_MAX_ITER, max_eval=None,
                   tolerance_grad=1e-7, tolerance_change=1e-9,
                   history_size=BATCHED_HISTORY):
    """MyLBFGS run independently for every row of theta, with converged rows compacted out.

    Same algorithm as the unbatched optimizer: strong-Wolfe line search, two-loop
    recursion, and the same five convergence tests -- each evaluated per cluster.
    """
    B0, D = theta.shape
    dev, dt = theta.device, theta.dtype
    if max_eval is None:
        max_eval = max_iter * 5 // 4

    theta = theta.clone()
    alive = torch.arange(B0, device=dev)                  # row -> original cluster index
    out_theta = theta.clone()
    out_loss = torch.zeros(B0, device=dev, dtype=dt)
    out_exit = torch.zeros(B0, dtype=torch.long, device=dev)
    out_iter = torch.zeros(B0, dtype=torch.long, device=dev)

    loss, flat_grad = fg(theta, alive)
    out_loss[alive] = loss
    evals = torch.ones(len(alive), device=dev, dtype=dt)

    fin = flat_grad.abs().max(-1).values <= tolerance_grad
    if fin.any():
        keep = ~fin
        out_exit[alive[fin]] = 5
        out_theta[alive[fin]] = theta[fin]
        theta, loss, flat_grad, alive, evals = (theta[keep], loss[keep], flat_grad[keep],
                                                alive[keep], evals[keep])
    if len(alive) == 0:
        return out_theta, out_loss, out_exit, out_iter

    # Grow the history lazily: typical fits converge in ~15 iterations, so preallocating
    # all history_size slots would make every compaction copy far more than is ever read.
    cap = 8
    n = len(alive)
    old_y = torch.zeros(n, cap, D, device=dev, dtype=dt)
    old_s = torch.zeros(n, cap, D, device=dev, dtype=dt)
    ro = torch.zeros(n, cap, device=dev, dtype=dt)
    H_diag = torch.ones(n, device=dev, dtype=dt)
    n_hist = 0
    d = t = prev_grad = None

    def obj_func(xs, tt, dd, rws):
        return fg(xs + tt.unsqueeze(-1) * dd, rws)

    for n_iter in range(1, max_iter + 1):
        if n_iter == 1:
            d = -flat_grad
            H_diag = torch.ones_like(H_diag)
        else:
            yv = flat_grad - prev_grad
            sv = d * t.unsqueeze(-1)
            ys = (yv * sv).sum(-1)
            good = ys > 1e-10
            if n_hist == cap and cap < history_size:
                grow = min(cap * 2, history_size) - cap
                old_y = torch.cat([old_y, torch.zeros(n_hist and len(old_y), grow, D,
                                                      device=dev, dtype=dt)], 1)
                old_s = torch.cat([old_s, torch.zeros(len(old_s), grow, D,
                                                      device=dev, dtype=dt)], 1)
                ro = torch.cat([ro, torch.zeros(len(ro), grow, device=dev, dtype=dt)], 1)
                cap += grow
            slot = min(n_hist, history_size - 1)
            if n_hist == history_size:                      # shift history by one
                old_y[:, :-1] = old_y[:, 1:].clone()
                old_s[:, :-1] = old_s[:, 1:].clone()
                ro[:, :-1] = ro[:, 1:].clone()
            zero = torch.zeros_like(yv)
            old_y[:, slot] = torch.where(good.unsqueeze(-1), yv, zero)
            old_s[:, slot] = torch.where(good.unsqueeze(-1), sv, zero)
            # ro = 0 makes a skipped slot contribute nothing to the two-loop recursion,
            # which is how a cluster whose ys <= 1e-10 declines the update stays in step
            # with the clusters that took it.
            ro[:, slot] = torch.where(good, 1. / ys, torch.zeros_like(ys))
            H_diag = torch.where(good, ys / (yv * yv).sum(-1).clamp(min=1e-30), H_diag)
            n_hist = min(n_hist + 1, history_size)

            q = -flat_grad
            al = torch.zeros(len(q), n_hist, device=dev, dtype=dt)
            for i in range(n_hist - 1, -1, -1):
                al[:, i] = (old_s[:, i] * q).sum(-1) * ro[:, i]
                q = q - al[:, i].unsqueeze(-1) * old_y[:, i]
            r = q * H_diag.unsqueeze(-1)
            for i in range(n_hist):
                be = (old_y[:, i] * r).sum(-1) * ro[:, i]
                r = r + (al[:, i] - be).unsqueeze(-1) * old_s[:, i]
            d = r

        prev_grad = flat_grad.clone()
        prev_loss = loss.clone()
        t = (torch.clamp(1. / flat_grad.abs().sum(-1), max=1.) * lr if n_iter == 1
             else torch.full_like(loss, lr))

        gtd = (flat_grad * d).sum(-1)
        stalled = gtd > -tolerance_change
        if stalled.any():
            keep = ~stalled
            idx = alive[stalled]
            out_exit[idx], out_iter[idx] = 4, n_iter - 1
            out_theta[idx], out_loss[idx] = theta[stalled], loss[stalled]
            (theta, loss, flat_grad, d, t, gtd, prev_grad, alive, evals,
             old_y, old_s, ro, H_diag) = [
                v[keep] for v in (theta, loss, flat_grad, d, t, gtd, prev_grad, alive,
                                  evals, old_y, old_s, ro, H_diag)]
            prev_loss = prev_loss[keep]
            if len(alive) == 0:
                break

        loss, flat_grad, t, ls_evals = _batched_strong_wolfe(
            obj_func, alive, theta, t, d, loss, flat_grad, gtd)
        theta = theta + t.unsqueeze(-1) * d
        evals = evals + ls_evals

        step = (d * t.unsqueeze(-1)).abs().max(-1).values
        code = torch.full((len(alive),), -1, dtype=torch.long, device=dev)
        code = torch.where(flat_grad.abs().max(-1).values <= tolerance_grad,
                           torch.ones_like(code), code)
        code = torch.where((code < 0) & (step <= tolerance_change),
                           torch.full_like(code, 2), code)
        code = torch.where((code < 0) & ((loss - prev_loss).abs() < tolerance_change),
                           torch.full_like(code, 3), code)
        code = torch.where((code < 0) & ((n_iter == max_iter) | (evals >= max_eval)),
                           torch.zeros_like(code), code)

        fin = code >= 0
        if fin.any():
            idx = alive[fin]
            out_exit[idx], out_iter[idx] = code[fin], n_iter
            out_theta[idx], out_loss[idx] = theta[fin], loss[fin]
        keep = ~fin
        if not keep.any():
            alive = alive[keep]
            break
        if fin.any():
            # Compact on every iteration a cluster finishes: index_select on these small
            # tensors is far cheaper than carrying a converged cluster through another
            # objective evaluation, so there is no threshold worth waiting for.
            (theta, loss, flat_grad, d, t, prev_grad, alive, evals,
             old_y, old_s, ro, H_diag) = [
                v[keep] for v in (theta, loss, flat_grad, d, t, prev_grad, alive, evals,
                                  old_y, old_s, ro, H_diag)]

    if len(alive):
        out_exit[alive], out_iter[alive] = 0, max_iter
        out_theta[alive], out_loss[alive] = theta, loss
    return out_theta, out_loss, out_exit, out_iter


# --------------------------------------------------------------------------------------
# Cell collapsing: shrink the sample axis to the number of distinct design rows
# --------------------------------------------------------------------------------------
#
# The log joint depends on a sample only through its design row and its integer counts, so
# samples sharing a design row can be pooled and their counts histogrammed -- the idea
# leafcutter-rs is built on (src/design.rs, ClusterData::build). Grouping the per-sample
# term by cell c (a_nj = a_cj, A_n = A_c) and splitting the count sum on y = 0 vs y > 0,
# the zero entries cancel exactly between +sum_j lgamma(a_j + y_nj) and -sum_j lgamma(a_j),
# leaving, with n_c = samples in cell c whose row total is positive:
#
#   l = sum_c [  n_c * lgamma(A_c)
#              - sum_{w>0} M_cw * lgamma(A_c + w)
#              + sum_j ( sum_{v>0} m_cjv * lgamma(a_cj + v) - nnz_cj * lgamma(a_cj) ) ]
#
# This is an exact rewrite, verified against the dense form in value and gradient to
# float64 roundoff -- not an approximation.
#
# What it buys, and what it does not: the two count-free terms collapse from N to C and
# stop depending on the cohort size altogether. The count-dependent terms still need one
# lgamma per DISTINCT non-zero count, because the sequential recurrence leafcutter-rs
# walks (lgamma(a+v+1) = lgamma(a+v) + ln(a+v) over a sorted histogram) cannot be
# vectorised. So this is a constant-factor win -- about 3x fewer lgamma calls on real
# cohorts -- and stays O(N), where the Rust implementation is flat in N.
#
# It composes with batching rather than competing with it: batching amortises per-op
# dispatch over the cluster axis, collapsing shrinks the sample axis, and the tensors
# simply become [B, C, J] instead of [B, N, J].


def _collapse_cells(x_full):
    """Distinct design rows. Returns (cell_of [N], x_cells [C x P]).

    Cells are keyed on the FULL design row, so the null design -- a column subset -- is
    constant within a cell too and the same partition serves both fits.
    """
    x_cells, inv = np.unique(x_full, axis=0, return_inverse=True)
    return inv.astype(np.int64).reshape(-1), x_cells


def _runlength_rows(mat):
    """`mat` [R x n], each row sorted -> (row, value, multiplicity) for every run.

    Runs never straddle rows because position 0 of each row is forced to start one.
    """
    new = np.ones(mat.shape, dtype=bool)
    new[:, 1:] = mat[:, 1:] != mat[:, :-1]
    pos = np.flatnonzero(new.ravel())
    mult = np.diff(np.append(pos, mat.size))
    return pos // mat.shape[1], mat.ravel()[pos], mult


def _ragged_take(offsets, counts, rows):
    """Gather index for the concatenation of blocks `rows`, given per-block offsets/counts.

    Blocks are contiguous, so a subset is built with three vector ops instead of a mask
    over the whole pack -- which matters because the optimizer re-subsets on every line
    search step.
    """
    lens = counts[rows]
    total = int(lens.sum())
    if total == 0:
        empty = torch.zeros(0, dtype=torch.long, device=offsets.device)
        return empty, empty
    starts = torch.repeat_interleave(offsets[rows] - (lens.cumsum(0) - lens), lens)
    idx = torch.arange(total, device=offsets.device) + starts
    block = torch.repeat_interleave(torch.arange(len(rows), device=offsets.device), lens)
    return idx, block


def _sort_by_block(block, B, *arrays):
    """Sort a flat pack by its block id so subsets become contiguous ranges."""
    order = np.argsort(block, kind="stable")
    block = block[order]
    counts = np.bincount(block, minlength=B)
    offsets = np.concatenate([[0], np.cumsum(counts)[:-1]])
    return (torch.from_numpy(counts.astype(np.int64)),
            torch.from_numpy(offsets.astype(np.int64))) + tuple(
        torch.from_numpy(np.ascontiguousarray(a[order])) for a in arrays)


def _collapse_pack(y_np, cell_of, C, J):
    """One-off per batch: the sufficient statistics the collapsed log joint reads.

    y_np is [B x N x J] and cell_of [N]. Cost is proportional to B*N*J once, which the
    dense form pays on *every* objective evaluation.
    """
    B = y_np.shape[0]
    vb, vidx_local, vval, vmul = [], [], [], []
    tb, tidx_local, tval, tmul = [], [], [], []

    for c in range(C):
        sub = y_np[:, cell_of == c, :]                       # [B x n_c x J]
        nc = sub.shape[1]
        if nc == 0:
            continue
        tots = sub.sum(2)                                    # [B x n_c]

        # per (cluster, intron): distinct non-zero counts and how many samples hold each
        flat = np.sort(sub.transpose(0, 2, 1).reshape(-1, nc), axis=1)
        row, val, mul = _runlength_rows(flat)
        keep = val > 0
        row, val, mul = row[keep], val[keep], mul[keep]
        b, j = row // J, row % J
        vb.append(b); vidx_local.append(c * J + j)
        vval.append(val.astype(np.float64)); vmul.append(mul.astype(np.float64))

        # per cluster: distinct non-zero row totals in this cell
        row, val, mul = _runlength_rows(np.sort(tots, axis=1))
        keep = val > 0
        row, val, mul = row[keep], val[keep], mul[keep]
        tb.append(row); tidx_local.append(np.full(row.shape, c, dtype=np.int64))
        tval.append(val.astype(np.float64)); tmul.append(mul.astype(np.float64))

    cat = lambda L, d: (np.concatenate(L).astype(d) if L else np.zeros(0, d))
    vcnt, voff, vil, vv, vm = _sort_by_block(
        cat(vb, np.int64), B, cat(vidx_local, np.int64), cat(vval, np.float64), cat(vmul, np.float64))
    tcnt, toff, til, tv, tm = _sort_by_block(
        cat(tb, np.int64), B, cat(tidx_local, np.int64), cat(tval, np.float64), cat(tmul, np.float64))

    return dict(C=C, J=J, B=B,
                v_counts=vcnt, v_offsets=voff, v_local=vil, v_val=vv, v_mul=vm,
                t_counts=tcnt, t_offsets=toff, t_local=til, t_val=tv, t_mul=tm)


def _collapse_pack_subset(pack, idx):
    """Restrict a pack to a subset of clusters (used by the smart-init and refit paths)."""
    vi, vb = _ragged_take(pack['v_offsets'], pack['v_counts'], idx)
    ti, tb = _ragged_take(pack['t_offsets'], pack['t_counts'], idx)
    out = dict(pack)
    out['B'] = len(idx)
    for k, src, sel, blk in (('v', vi, vi, vb), ('t', ti, ti, tb)):
        cnt = pack[k + '_counts'][idx]
        out[k + '_counts'] = cnt
        out[k + '_offsets'] = torch.cat([torch.zeros(1, dtype=torch.long),
                                         cnt.cumsum(0)[:-1]])
        out[k + '_local'] = pack[k + '_local'][sel]
        out[k + '_val'] = pack[k + '_val'][sel]
        out[k + '_mul'] = pack[k + '_mul'][sel]
    return out


class _CollapsedFg:
    """fg(theta, rows) for the collapsed form, with the row subset cached.

    The optimizer re-subsets on every line search step, so the flat packs are sorted by
    cluster and a subset is three vector ops over exactly the entries about to be read --
    never a mask over the whole batch.
    """

    def __init__(self, x_cells, pack, P, J, A_qr, conc_max, eps, conc_shape, conc_rate):
        self.x = x_cells                      # [B x C x P]
        self.pack = pack
        self.P, self.J, self.A_qr = P, J, A_qr
        self.conc_max, self.eps = conc_max, eps
        self.conc_shape, self.conc_rate = conc_shape, conc_rate
        self.lg_shape = float(torch.lgamma(torch.tensor(float(conc_shape))))
        self.CJ = pack['C'] * J
        self._rows = None
        self._cache = None

    def _select(self, rows):
        p = self.pack
        vi, vb = _ragged_take(p['v_offsets'], p['v_counts'], rows)
        ti, tb = _ragged_take(p['t_offsets'], p['t_counts'], rows)
        self._cache = dict(
            x=self.x[rows],
            v_flat=vb * self.CJ + p['v_local'][vi], v_val=p['v_val'][vi],
            v_mul=p['v_mul'][vi], v_b=vb,
            t_flat=tb * p['C'] + p['t_local'][ti], t_val=p['t_val'][ti],
            t_mul=p['t_mul'][ti], t_b=tb, n=len(rows))
        self._rows = rows

    def __call__(self, theta, rows=None):
        if rows is None:
            rows = torch.arange(self.pack['B'])
        if self._rows is not rows:
            self._select(rows)
        c = self._cache
        th = theta.detach().requires_grad_(True)
        beta, conc = _unpack(th, self.P, self.J, self.A_qr, self.conc_max)

        # Evaluated in float64 while the rest of the fit stays float32, for two reasons
        # that compound. Each summand below is lgamma(a+v) - lgamma(a), which for a count
        # of a few thousand is ~1e4, and one cluster accumulates hundreds of them into a
        # ~1e5 total; and index_add accumulates sequentially where torch.sum is pairwise.
        # Measured in float32 that lands ~2.2 absolute away from the true log joint,
        # against ~0.05 for the dense form -- and loglr, the quantity actually tested, is
        # only O(1-50), so the error would reach the p-value. The float64 arithmetic is
        # confined to the histogram terms; theta and the optimizer stay float32.
        a = (c['x'].double() @ beta.double()).softmax(-1) * conc.double().unsqueeze(-2) + self.eps
        sa = a.sum(-1)
        af, saf = a.reshape(-1), sa.reshape(-1)
        lga, lgsa = a.lgamma().reshape(-1), sa.lgamma().reshape(-1)
        zero = torch.zeros(c['n'], dtype=torch.float64, device=a.device)

        # sum_v m_cjv = nnz_cj and sum_w M_cw = n_c exactly, so the two count-free terms
        # of the log joint fold in here as differences instead of being accumulated
        # separately as large near-cancelling sums.
        ll = zero.index_add(0, c['v_b'],
                            ((af[c['v_flat']] + c['v_val']).lgamma() - lga[c['v_flat']])
                            * c['v_mul'])
        ll = ll - zero.index_add(0, c['t_b'],
                                 ((saf[c['t_flat']] + c['t_val']).lgamma() - lgsa[c['t_flat']])
                                 * c['t_mul'])
        lp = (self.conc_shape * np.log(self.conc_rate) - self.lg_shape
              + (self.conc_shape - 1.) * conc.double().log()
              - self.conc_rate * conc.double()).sum(-1)
        loss = -(ll + lp)
        g, = torch.autograd.grad(loss.sum(), th)
        return loss.detach().to(theta.dtype), g.to(theta.dtype)
# ------------------------------------------------------------------ batched initializers

def _rr_init_batched(x, y, regularizer=0.001):
    """Batched rr_initialization. x [B x N x P], y [B x N x J] -> beta [B x P x J]."""
    y_norm = torch.log((y + 1) / (y + 1).sum(-1, keepdim=True))
    I = torch.eye(x.shape[-1], dtype=x.dtype, device=x.device)
    xt = x.transpose(-1, -2)
    beta = torch.linalg.solve(xt @ x + regularizer * I, xt @ y_norm)
    return beta - beta.mean(-1, keepdim=True)


def _brr_init_batched(x, y, max_iter=300, tol=1e-3,
                      alpha_1=1e-6, alpha_2=1e-6, lambda_1=1e-6, lambda_2=1e-6):
    """Batched sklearn BayesianRidge, one regression per (cluster, junction).

    brr_initialization calls BayesianRidge.fit() J times per cluster; at 1.4 ms a call
    that is ~7% of the unbatched runtime, which would become the dominant cost once the
    fits themselves are batched. The design matrix is identical for every one of those
    regressions, so its SVD is computed once and only the per-problem alpha/lambda
    (MacKay's evidence updates) iterate -- vectorized over all B*J problems at once.
    """
    B, N, P = x.shape
    J = y.shape[-1]
    dtype, dev = x.dtype, x.device

    y_norm = torch.log((y + 1) / (y + 1).sum(-1, keepdim=True))       # [B x N x J]
    Y = y_norm.permute(0, 2, 1).reshape(B * J, N)                     # [M x N]
    M = B * J

    # sklearn fits an intercept, which centres X and each target
    Xc = x[0] - x[0].mean(0, keepdim=True)          # shared design; [N x P]
    y_var = Y.var(dim=1, unbiased=False)
    Yc = Y - Y.mean(dim=1, keepdim=True)

    U, S, Vh = torch.linalg.svd(Xc, full_matrices=False)
    ev = S ** 2                                     # [K], K = min(N, P) = P here
    XT_y = Yc @ Xc                                  # [M x P]

    alpha = 1. / (y_var + torch.finfo(dtype).eps)
    lam = torch.ones(M, dtype=dtype, device=dev)

    def update_coef(alpha_, lam_):
        # coef = Vh.T diag(1/(ev + lam/alpha)) Vh XT_y, per problem
        tmp = (XT_y @ Vh.t()) / (ev + (lam_ / alpha_).unsqueeze(-1))
        coef_ = tmp @ Vh
        sse_ = ((Yc - coef_ @ Xc.t()) ** 2).sum(-1)
        return coef_, sse_

    coef = torch.zeros(M, P, dtype=dtype, device=dev)
    coef_old = None
    active = torch.ones(M, dtype=torch.bool, device=dev)
    for it in range(max_iter):
        new_coef, sse = update_coef(alpha, lam)
        coef = torch.where(active.unsqueeze(-1), new_coef, coef)
        g = ((alpha.unsqueeze(-1) * ev) / (lam.unsqueeze(-1) + alpha.unsqueeze(-1) * ev)).sum(-1)
        new_lam = (g + 2 * lambda_1) / ((coef ** 2).sum(-1) + 2 * lambda_2)
        new_alpha = (N - g + 2 * alpha_1) / (sse + 2 * alpha_2)
        lam = torch.where(active, new_lam, lam)
        alpha = torch.where(active, new_alpha, alpha)
        if coef_old is not None:
            active = active & ((coef_old - coef).abs().sum(-1) >= tol)
            if not active.any():
                break
        coef_old = coef.clone()
    coef, _ = update_coef(alpha, lam)

    beta = coef.view(B, J, P).permute(0, 2, 1)                        # [B x P x J]
    return beta - beta.mean(-1, keepdim=True)


def _beta_to_theta(beta, A_qr, conc_max, init_conc=10.):
    """beta [B x P x J] -> theta [B x D], the space LBFGS optimizes in."""
    B, P, J = beta.shape
    G = A_qr.t() @ A_qr
    raw = torch.linalg.solve(G, A_qr.t() @ beta.transpose(-1, -2)).transpose(-1, -2)
    u = torch.full((B, J), float(np.log(init_conc / (conc_max - init_conc))),
                   dtype=beta.dtype, device=beta.device)
    return torch.cat([raw.reshape(B, P * (J - 1)), u], -1)


def _batched_fit_dm_glm(x, y, beta_init, A_qr, conc_max=3000., concShape=1.0001,
                        concRate=1e-4, eps=1e-8, collapsed=None):
    """Batched fit_dm_glm. Returns beta [B x P x J], conc [B x J], loss [B], exit [B].

    `collapsed`, when given, is (x_cells, pack) and the objective is evaluated over design
    cells instead of samples -- the same log joint, read off sufficient statistics.
    """
    P = x.shape[-1]
    J = y.shape[-1]
    theta = _beta_to_theta(beta_init, A_qr, conc_max)
    if collapsed is not None:
        x_cells, pack = collapsed
        fg = _CollapsedFg(x_cells[..., :P].contiguous(), pack, P, J, A_qr,
                          conc_max, eps, concShape, concRate)
    else:
        fg = _make_fg(x, y, P, J, A_qr, conc_max, eps, concShape, concRate)
    theta, loss, exit_code, _ = _batched_lbfgs(theta, fg)
    beta, conc = _unpack(theta, P, J, A_qr, conc_max)
    return beta, conc, loss, exit_code


def _batched_dm_anova(x_full, x_null, y, init="brr", smart_init=True, collapsed=None,
                      **kwargs):
    """Batched dirichlet_multinomial_anova over B clusters that share x and J."""
    J = y.shape[-1]
    A_qr = _qr_basis(J, y.dtype, y.device)
    P_full, P_null = x_full.shape[-1], x_null.shape[-1]
    timing = {}

    def get_init(xx):
        if init == "brr":
            return _brr_init_batched(xx, y)
        if init == "rr":
            return _rr_init_batched(xx, y)
        if init == "0":
            return torch.zeros(y.shape[0], xx.shape[-1], J, dtype=y.dtype, device=y.device)
        raise ValueError(f"the batched engine supports --init brr, rr or 0, not {init!r}")

    t0 = time.time()
    init_null = get_init(x_null)
    timing['t_null_init'] = time.time() - t0

    t0 = time.time()
    nb, nc, null_loss, null_ex = _batched_fit_dm_glm(x_null, y, init_null, A_qr,
                                                     collapsed=collapsed, **kwargs)
    timing['t_null_fit'] = time.time() - t0

    pad = torch.zeros(y.shape[0], P_full - P_null, J, dtype=y.dtype, device=y.device)
    t0 = time.time()
    fb, fc, full_loss, full_ex = _batched_fit_dm_glm(
        x_full, y, torch.cat([nb, pad], 1), A_qr, collapsed=collapsed, **kwargs)
    timing['t_full_fit_from_null'] = time.time() - t0

    if smart_init:
        t0 = time.time()
        init_full = get_init(x_full)
        timing['t_full_init'] = time.time() - t0
        t0 = time.time()
        sb, sc, s_loss, s_ex = _batched_fit_dm_glm(x_full, y, init_full, A_qr,
                                                   collapsed=collapsed, **kwargs)
        timing['t_full_fit_smart'] = time.time() - t0
        better = s_loss < full_loss
        fb = torch.where(better[:, None, None], sb, fb)
        fc = torch.where(better[:, None], sc, fc)
        full_ex = torch.where(better, s_ex, full_ex)
        full_loss = torch.where(better, s_loss, full_loss)
        timing['smart_init_improved'] = better
    else:
        timing['t_full_init'] = timing['t_full_fit_smart'] = 0.
        timing['smart_init_improved'] = None

    df = (P_full - P_null) * (J - 1)
    loglr = null_loss - full_loss
    p = scipy.stats.chi2(df).sf(2. * loglr.cpu().numpy())

    # where the result looks highly significant, check whether the null fit can be
    # improved by starting it from the full fit (same guard as the unbatched code)
    timing['t_refit_null'] = 0.
    hit = torch.as_tensor(p < 0.001, device=y.device)
    if hit.any():
        idx = torch.nonzero(hit).squeeze(-1)
        t0 = time.time()
        sub_collapsed = None if collapsed is None else (
            collapsed[0][idx], _collapse_pack_subset(collapsed[1], idx))
        rb, rc, r_loss, r_ex = _batched_fit_dm_glm(
            x_null[idx], y[idx], fb[idx, :P_null, :], A_qr,
            collapsed=sub_collapsed, **kwargs)
        timing['t_refit_null'] = time.time() - t0
        imp = r_loss < null_loss[idx]
        sel = idx[imp]
        null_loss[sel], nb[sel], nc[sel], null_ex[sel] = (r_loss[imp], rb[imp], rc[imp],
                                                          r_ex[imp])
        loglr = null_loss - full_loss
        p = scipy.stats.chi2(df).sf(2. * loglr.cpu().numpy())

    return dict(loglr=loglr, df=df, p=p, null_loss=null_loss, full_loss=full_loss,
                null_exit=null_ex, full_exit=full_ex, full_beta=fb, full_conc=fc,
                timing=timing)


# ------------------------------------------------------------------- batched driver

def _build_design(x, confounders):
    """The design matrices, built once over ALL samples rather than per cluster.

    task() rebuilds these per cluster from the samples with non-zero coverage. Keeping
    every row instead is exact, not an approximation: a zero-coverage row contributes
    exactly zero to the log joint and to its gradient, whatever its covariate values.
    """
    if x.dtype.kind in 'OUS':
        x_only = pd.get_dummies(x, drop_first=True)
        x_only = x_only.loc[:, ~(x_only == 0).all()]
    else:
        x_only = pd.DataFrame({"x": x})
    n = len(x)
    cols = [np.ones((n, 1))]
    if confounders is not None:
        conf = confounders.to_numpy().astype(np.float64)
        conf = conf[:, conf.std(0) != 0.]
        cols.append(conf)
    x_null = np.concatenate(cols, axis=1)
    x_full = np.concatenate(cols + [x_only.to_numpy().astype(np.float64)], axis=1)
    # a fit would still return a p and PSI for an effect that cannot be estimated
    if np.linalg.matrix_rank(x_full) < x_full.shape[1]:
        raise ValueError("The design is not of full rank: a covariate matches the two groups, "
                         "or is determined by the other covariates")
    return (x_full.astype(np.float32), x_null.astype(np.float32),
            list(x_only.columns), x_only.shape[1])


def _screen_clusters(buf, cluster_ids, cluster_starts, x, max_cluster_size,
                     min_samples_per_intron, min_samples_per_group, min_coverage,
                     min_unique_vals):
    """Apply task()'s filters and return (survivors, status).

    survivors: list of (cluster position, counts [N x J'], introns_to_use mask)
    status:    the per-cluster skip reason, verbatim from task() so the two engines
               report the same counts.
    """
    status = ["Success"] * len(cluster_ids)
    survivors = []
    xv = x.to_numpy() if hasattr(x, "to_numpy") else np.asarray(x)
    categorical = xv.dtype.kind in 'OUS'
    for i in range(len(cluster_ids)):
        s, e = int(cluster_starts[i]), int(cluster_starts[i + 1])
        cc = buf[:, s:e]
        if cc.shape[1] > max_cluster_size:
            status[i] = "Too many introns in cluster"
            continue
        if cc.shape[1] <= 1:
            status[i] = "<=1 junction in cluster"
            continue
        totals = cc.sum(1)
        keep_row = totals > 0
        if keep_row.sum() <= 1:
            status[i] = "<=1 sample with coverage>0"
            continue
        covered = keep_row & (totals >= min_coverage)
        if covered.sum() <= 1:
            status[i] = "<=1 sample with coverage>min_coverage"
            continue
        use = (cc[keep_row] > 0).sum(0) >= min_samples_per_intron
        if use.sum() < 2:
            status[i] = "<2 introns used in >=min_samples_per_intron samples"
            continue
        uniq, ta = np.unique(xv[covered], return_counts=True)
        if categorical:
            if (ta >= min_samples_per_group).sum() < 2:
                status[i] = "Not enough valid samples"
                continue
        elif len(uniq) < min_unique_vals:
            status[i] = "Not enough valid samples"
            continue
        survivors.append((i, cc[:, use].astype(np.float32), use))
    return survivors, status


def _batched_chunk(job, x_full, x_null, x_dim, init, smart_init, kwargs,
                   collapse=None):
    """One (J bucket, chunk) unit of work: fit it and return plain arrays.

    Module-level so it survives pickling to a Pool worker under the "spawn" start method.
    """
    positions, y_stack = job
    y = torch.from_numpy(y_stack)
    B = y.shape[0]
    xf = torch.from_numpy(x_full).unsqueeze(0).expand(B, -1, -1).contiguous()
    xn = torch.from_numpy(x_null).unsqueeze(0).expand(B, -1, -1).contiguous()
    collapsed = None
    if collapse is not None:
        cell_of, x_cells = collapse
        pack = _collapse_pack(y_stack, cell_of, x_cells.shape[0], y.shape[-1])
        xc = torch.from_numpy(x_cells).unsqueeze(0).expand(B, -1, -1).contiguous()
        collapsed = (xc, pack)
    res = _batched_dm_anova(xf, xn, y, init=init, smart_init=smart_init,
                            collapsed=collapsed, **kwargs)

    P_null = x_null.shape[1]
    fb, fc = res['full_beta'], res['full_conc']
    base = (fb[:, 0, :].softmax(-1) * fc)
    psi_0 = (base / base.sum(-1, keepdim=True)).numpy()
    psi = np.empty((B, y.shape[-1], x_dim), dtype=np.float32)
    for k in range(x_dim):
        pk = ((fb[:, 0, :] + fb[:, P_null + k, :]).softmax(-1) * fc)
        psi[:, :, k] = (pk / pk.sum(-1, keepdim=True)).numpy()
    logef = fb[:, -x_dim:, :].transpose(1, 2).numpy()          # [B x J x x_dim]

    t = res['timing']
    imp = t['smart_init_improved']
    return dict(positions=positions,
                loglr=res['loglr'].numpy(), df=res['df'], p=res['p'],
                null_ll=-res['null_loss'].numpy(), full_ll=-res['full_loss'].numpy(),
                null_exit=res['null_exit'].numpy(), full_exit=res['full_exit'].numpy(),
                psi_0=psi_0, psi=psi, logef=logef,
                smart_init_improved=(None if imp is None else imp.numpy()),
                timing={k: v for k, v in t.items() if k.startswith('t_')}, n=B)


def differential_splicing_batched(buf, intron_ids, cluster_ids, cluster_starts, x,
                                  confounders=None, max_cluster_size=float('inf'),
                                  min_samples_per_intron=5, min_samples_per_group=4,
                                  min_coverage=0, min_unique_vals=10,
                                  num_cores=1, init="brr", smart_init=True, max_batch=4096,
                                  collapse="auto", *, stages, **kwargs):
    """Fit every cluster that survives filtering, B clusters at a time.

    Returns (cluster_table, junc_table, status_df). Both tables are None when no cluster
    survives, which status_df then explains.
    """
    x_full, x_null, x_cols, x_dim = _build_design(x, confounders)
    survivors, status = _screen_clusters(
        buf, cluster_ids, cluster_starts, x, max_cluster_size, min_samples_per_intron,
        min_samples_per_group, min_coverage, min_unique_vals)
    stages.mark("filter")

    status_df = pd.DataFrame({"status": status})
    status_df.index = cluster_ids
    if not survivors:
        return None, None, status_df

    # Bucket by J. Clusters in a bucket share [N, J] exactly, so no padding is needed --
    # and padding the J axis would not be valid anyway (softmax normalizes over J).
    buckets = {}
    for pos, counts_arr, use in survivors:
        buckets.setdefault(counts_arr.shape[1], []).append((pos, counts_arr, use))
    jobs = []
    for J in sorted(buckets):
        items = buckets[J]
        for k in range(0, len(items), max_batch):
            chunk = items[k:k + max_batch]
            jobs.append(([c[0] for c in chunk], np.stack([c[1] for c in chunk])))

    # Collapsing pays when the design has far fewer distinct rows than samples. With a
    # continuous covariate every sample is its own cell and the rewrite is pure overhead,
    # so "auto" declines rather than degrading quietly.
    cell_of, x_cells = _collapse_cells(x_full)
    C, N = x_cells.shape[0], x_full.shape[0]
    use_collapse = (True if collapse == "on" else
                    False if collapse == "off" else C * 2 <= N)
    print(f"  design cells: {C} distinct rows over {N} samples -- collapsing "
          f"{'ON' if use_collapse else 'OFF'}")

    worker = partial(_batched_chunk, x_full=x_full, x_null=x_null, x_dim=x_dim,
                     init=init, smart_init=smart_init, kwargs=kwargs,
                     collapse=((cell_of, x_cells) if use_collapse else None))
    if len(survivors) < MIN_CLUSTERS_FOR_WORKERS:
        num_cores = 1
    num_cores = min(num_cores, len(jobs))
    if num_cores == 1:
        _init_worker()
        results = [worker(j) for j in jobs]
    else:
        # spawn on every platform: the parent has already loaded torch, which is not safe to
        # fork, and the default start method differs across platforms and python versions.
        with multiprocessing.get_context("spawn").Pool(processes=num_cores,
                                                       initializer=_init_worker) as pool:
            results = list(pool.imap_unordered(worker, jobs))
    stages.mark("fit")

    use_of ={pos: use for pos, _, use in survivors}
    intron_index = pd.Index(intron_ids)
    tested, junc_frames = {}, []
    for r in results:
        for b, pos in enumerate(r['positions']):
            clu = cluster_ids[pos]
            tested[clu] = {
                'loglr': float(r['loglr'][b]), 'null_ll': float(r['null_ll'][b]),
                'null_exit_status': BATCHED_EXIT[int(r['null_exit'][b])],
                'full_ll': float(r['full_ll'][b]),
                'full_exit_status': BATCHED_EXIT[int(r['full_exit'][b])],
                'df': r['df'], 'p': float(r['p'][b]),
            }
            s, e = int(cluster_starts[pos]), int(cluster_starts[pos + 1])
            use = use_of[pos]
            nj = int(use.sum())
            frame = pd.DataFrame({'cluster': [clu] * nj,
                                  'intron': intron_index[s:e][use],
                                  'psi_0': r['psi_0'][b, :nj]})
            for k, col in enumerate(x_cols):
                frame['logef_' + str(col)] = r['logef'][b, :nj, k]
            for k, col in enumerate(x_cols):
                frame['psi_' + str(col)] = r['psi'][b, :nj, k]
            junc_frames.append(frame)

    # results arrive in completion order; keep the input cluster order
    order = [c for c in cluster_ids if c in tested]
    cluster_table = pd.DataFrame([tested[c] for c in order], index=order)
    cluster_table['p.adjust'] = robust_fdr(cluster_table['p'], method='bh')

    junc_table = pd.concat(junc_frames, axis=0)
    junc_table = junc_table.set_index('cluster').loc[order].reset_index()
    stages.mark("collect_results")
    return cluster_table, junc_table, status_df


# --------------------------------------------------------------------------------------
# Request handling
# --------------------------------------------------------------------------------------

def portal_tables(cluster_table, junc_table, cluster_ids, cluster_genes):
    """The engine's tables -> the (clusters, junctions) tables the screen also produces.

    A cluster's effect is the signed model-based deltaPSI of its largest |deltaPSI| junction,
    the same rule the screen applies to its descriptive PSI.
    """
    meta = get_intron_meta(junc_table["intron"].to_numpy())
    j = pd.DataFrame({
        "clu": junc_table["cluster"].to_numpy(),
        "intron": junc_table["intron"].to_numpy(),
        "chr": meta["chr"].to_numpy(),
        "start": meta["start"].astype(np.int64).to_numpy(),
        "stop": meta["end"].astype(np.int64).to_numpy(),
        "psi_control": junc_table["psi_0"].to_numpy(dtype=np.float64),
        "psi_case": junc_table["psi_case"].to_numpy(dtype=np.float64)})
    j["deltapsi"] = j["psi_case"] - j["psi_control"]
    j["cluster"] = j["chr"] + ":" + j["clu"]

    groups = j.groupby("clu", sort=False)
    top = j.loc[j["deltapsi"].abs().groupby(j["clu"], sort=False).idxmax()].set_index("clu")
    gene_of = dict(zip(cluster_ids, cluster_genes))
    clusters = cluster_table.copy()
    clu = clusters.index.to_numpy()
    out = pd.DataFrame({
        "cluster": top["cluster"].reindex(clu).to_numpy(),
        "genes": [gene_of.get(c, "") or np.nan for c in clu],
        "n_junc": groups.size().reindex(clu).to_numpy(),
        "p": clusters["p"].to_numpy(),
        "fdr": clusters["p.adjust"].to_numpy(),
        "deltapsi": top["deltapsi"].reindex(clu).to_numpy(),
        "top_intron": top["intron"].reindex(clu).to_numpy(),
        "psi_control": top["psi_control"].reindex(clu).to_numpy(),
        "psi_case": top["psi_case"].reindex(clu).to_numpy(),
        "chr": top["chr"].reindex(clu).to_numpy(),
        "start": groups["start"].min().reindex(clu).to_numpy(),
        "stop": groups["stop"].max().reindex(clu).to_numpy()})
    return out.sort_values("p", kind="stable").reset_index(drop=True), j


def junctions_by_cluster(junctions, cluster_ids):
    """Junction table -> {cluster id: [[start, stop, null, psi_control, psi_case], ...]}.

    Coordinates follow the junction track: intron ids hold the
    1-based last base of the left exon and first base of the right exon. The p slot is null
    because the test is per cluster, and repeating the cluster's p here would present it as a
    junction's own.
    """
    def psi(v):
        return round(float(v), 4) if np.isfinite(v) else None

    out = {}
    for r in junctions.itertuples(index=False):
        if r.cluster in cluster_ids:
            out.setdefault(r.cluster, []).append(
                [int(r.start) - 1, int(r.stop) - 1, None, psi(r.psi_control), psi(r.psi_case)])
    return out


def run_leafcutter(args):
    stages = StageTimes(_load_seconds)
    g1 = _read_sample_list(args.group1)
    g2 = _read_sample_list(args.group2)
    both = set(g1) & set(g2)
    if both:
        raise ValueError(f"{len(both)} sample(s) in both groups, e.g. {sorted(both)[:5]}")
    samples = g1 + g2

    buf, intron_ids, cluster_ids, cluster_starts, cluster_genes = read_h5_samples(args.h5, samples)
    stages.mark("read_h5")

    # baseline first, so psi_0 / logef are relative to the control group
    x = pd.Series(pd.Categorical(["control"] * len(g1) + ["case"] * len(g2),
                                 categories=["control", "case"], ordered=True))
    confounders = _encode_covariates(args.covariates, samples) if args.covariates else None

    cluster_table, junc_table, status_df = differential_splicing_batched(
        buf, intron_ids, cluster_ids, cluster_starts, x, confounders=confounders,
        max_cluster_size=args.max_cluster_size,
        min_samples_per_intron=args.min_samples_per_intron,
        min_samples_per_group=args.min_samples_per_group,
        min_coverage=args.min_coverage,
        num_cores=min(args.num_threads, _available_cpus()),
        stages=stages)

    skipped = {reason: int(n) for reason, n in Counter(status_df["status"]).items()
               if reason != "Success"}
    body = {"num_controls": len(g1), "num_cases": len(g2), "skipped": skipped}
    if cluster_table is None:
        return {**body, "status": "no_clusters", "cluster_data": [], "junctions_by_cluster": {},
                "n_clusters_tested": 0, "n_significant_fdr05": 0, "truncated": False,
                "timings": stages.report()}

    out, junctions = portal_tables(cluster_table, junc_table, cluster_ids, cluster_genes)
    n_tested = len(out)
    n_sig = int((out["fdr"] < 0.05).sum())
    truncated = args.top is not None and n_tested > args.top
    if truncated:
        out = out.head(args.top)
    body = {**body,
            "cluster_data": cluster_rows(out, "control", "case"),
            "junctions_by_cluster": junctions_by_cluster(junctions, set(out["cluster"])),
            "n_clusters_tested": n_tested,
            "n_significant_fdr05": n_sig,
            "truncated": truncated}
    stages.mark("format_output")
    body["timings"] = stages.report()
    return body


def handle(req):
    if req.get("selftest"):
        return selftest()

    def field(key, default=None, required=False, cast=None):
        v = req.get(key)
        if v is None:
            if required:
                raise ValueError(f"missing required field: {key!r}")
            return default
        return cast(v) if cast else v

    max_cluster = field("max_cluster_size")
    args = argparse.Namespace(
        h5=field("h5", required=True, cast=str),
        group1=field("group1", required=True),
        group2=field("group2", required=True),
        covariates=field("covariates"),
        min_coverage=field("min_coverage", 20, cast=int),
        min_samples_per_intron=field("min_samples_per_intron", 5, cast=int),
        min_samples_per_group=field("min_samples_per_group", 3, cast=int),
        max_cluster_size=float("inf") if max_cluster is None else int(max_cluster),
        num_threads=field("threads", 8, cast=int),
        top=field("top", cast=int),
    )
    if args.num_threads < 1:
        raise ValueError("threads must be >= 1")
    return run_leafcutter(args)


# --------------------------------------------------------------------------------------
# Selftest
# --------------------------------------------------------------------------------------

def _line_search_step(rows):
    """The step of the first row from a line search, where row 0 is a quadratic with its minimum
    at 1, and row 1 is downhill forever, so it uses its whole budget and never brackets."""
    def fg(x, rws):
        quadratic = (rws == 0).unsqueeze(-1)
        loss = torch.where(quadratic, (x - 1) ** 2, -x).sum(-1)
        return loss, torch.where(quadratic, 2 * (x - 1), -torch.ones_like(x))

    rows = torch.tensor(rows)
    x = torch.zeros(len(rows), 1, dtype=torch.float64)
    f, g = fg(x, rows)
    d = -g
    # this first step overshoots the quadratic, which then has to zoom back from t=0
    t = torch.full((len(rows),), 100., dtype=torch.float64)
    step = _batched_strong_wolfe(lambda xs, tt, dd, rws: fg(xs + tt.unsqueeze(-1) * dd, rws),
                                 rows, x, t, d, f, g, (g * d).sum(-1))[2]
    return float(step[0])


def selftest():
    """Offline run on a small synthetic store, see python/test/diffSpliceLeafcutter.unit.spec.js."""
    import h5py

    rng = np.random.default_rng(1)
    n1, n2 = 12, 12
    samples = [f"s{i}" for i in range(n1 + n2)]

    def counts(psi):
        return rng.multinomial(200, psi, size=n1 + n2 if isinstance(psi, list) else None)

    shifted = np.concatenate([rng.multinomial(200, [0.9, 0.1], size=n1),
                              rng.multinomial(200, [0.3, 0.7], size=n2)])
    flat = [counts([0.5, 0.5]) for _ in range(3)]
    # one intron is seen in no sample, so the cluster has only one usable intron
    one_intron = counts([1.0, 0.0])
    # below the coverage threshold in every sample
    low = rng.multinomial(4, [0.5, 0.5], size=n1 + n2)
    # covered in only one group
    one_group = np.concatenate([rng.multinomial(200, [0.5, 0.5], size=n1),
                                np.zeros((n2, 2), dtype=np.int64)])
    blocks = [shifted] + flat + [one_intron, low, one_group]
    names = [f"clu_{i}_+" for i in range(len(blocks))]
    X = np.concatenate(blocks, axis=1).astype(np.int32)
    introns, pos = [], 1000
    for clu, b in zip(names, blocks):
        for k in range(b.shape[1]):
            introns.append(f"chr1:{pos}:{pos + 100 + k}:{clu}:NE")
        pos += 1000
    starts = np.concatenate([[0], np.cumsum([b.shape[1] for b in blocks])])

    with tempfile.TemporaryDirectory(prefix="diffSpliceLeafcutter_") as tmp:
        h5 = os.path.join(tmp, "store.h5")
        str_type = h5py.string_dtype()
        with h5py.File(h5, "w") as f:
            f.attrs["layout"] = "samples_x_introns"
            f["X"] = X
            f.create_dataset("samples", data=samples, dtype=str_type)
            f.create_dataset("intron_ids", data=introns, dtype=str_type)
            f.create_dataset("cluster_ids", data=names, dtype=str_type)
            f.create_dataset("cluster_genes", data=["GENE"] + [""] * (len(names) - 1), dtype=str_type)
            f["cluster_starts"] = starts
        req = {"h5": h5, "group1": samples[:n1], "group2": samples[n1:]}
        res = handle(req)
        empty = handle({**req, "min_coverage": 100000})
        # one covariate differs within each group, and one has exactly the split of the groups
        with_covariate = handle({**req, "covariates": {s: {"c": i % 2} for i, s in enumerate(samples)}})
        try:
            handle({**req, "covariates": {s: {"c": int(i >= n1)} for i, s in enumerate(samples)}})
            collinear_error = ""
        except ValueError as e:
            collinear_error = str(e)

    rows = {r["cluster_id"]: r for r in res["cluster_data"]}
    hit = rows["chr1:clu_0_+"]
    junctions = res["junctions_by_cluster"]["chr1:clu_0_+"]
    checks = {
        "the shifted cluster ranks first": res["cluster_data"][0]["cluster_id"] == hit["cluster_id"],
        "the shifted cluster is significant": hit["adjusted_p_value"] < 1e-6,
        "the unshifted clusters are not": all(r["original_p_value"] > 1e-3 for k, r in rows.items()
                                              if k != hit["cluster_id"]),
        "deltaPSI is case minus control": 0.45 < abs(hit["delta_psi"]) < 0.75
        and abs(hit["delta_psi"] - (hit["psi_case"] - hit["psi_control"])) < 1e-9,
        "the cluster row has its gene and span": hit["genes"] == "GENE" and hit["n_junc"] == 2
        and (hit["start"], hit["stop"]) == (1000, 1101),
        "junctions are 0-based with no p": [j[:3] for j in junctions] == [[999, 1099, None], [999, 1100, None]],
        "only the clusters that pass the filter are tested": sorted(rows) == [
            f"chr1:clu_{i}_+" for i in range(4)],
        "skipped clusters are counted": sum(res["skipped"].values()) == 3,
        "no testable cluster is an outcome, with its reasons": empty["status"] == "no_clusters"
        and empty["cluster_data"] == [] and sum(empty["skipped"].values()) == len(names),
        "a line search does not depend on the other clusters in its batch":
        _line_search_step([0]) == _line_search_step([0, 1]) == 0.5,
        "a covariate that differs within the groups is fitted":
        with_covariate["cluster_data"][0]["cluster_id"] == hit["cluster_id"],
        "a covariate with the split of the groups is rejected": "not of full rank" in collinear_error,
        "timings cover every stage": set(res["timings"]) == {
            "load_packages", "read_h5", "filter", "fit", "collect_results", "format_output", "total"},
        "timings stop at the filter with no testable cluster": set(empty["timings"]) == {
            "load_packages", "read_h5", "filter", "total"},
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise AssertionError("; ".join(failed))
    return {"selftest": "ok", "cluster_data": [], "num_controls": n1, "num_cases": n2, "skipped": {}}


if __name__ == "__main__":
    raise SystemExit(main(handle))
