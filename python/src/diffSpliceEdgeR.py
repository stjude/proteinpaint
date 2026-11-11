"""
diffSpliceEdgeR.py -- genome-wide differential splicing screen for the volcano.

    run_python('diffSpliceEdgeR.py', JSON.stringify(req))

edgeR::diffSpliceDGE over every testable cluster; ~20 s genome-wide on a 186-sample
cohort. Never imports torch or pyro -- the screen fits no model, and those cost ~1.9 s of
the request. Use diffSpliceLeafcutter.py to drill into a hit with the exact test.

REQUEST
    {
      "h5":       "/path/cohort.h5",            required
      "group1":   ["s1", ...],                  required -- the CONTROL group
      "group2":   ["s3", ...],                  required -- the CASE group
      "covariates": {"s1": {"batch": "A"}, ...} default null (a path also works)
      "min_coverage":           20,
      "min_samples_per_intron":  5,             an absolute count: raise it on large
      "min_samples_per_group":   3,             cohorts or it silently loosens
      "max_cluster_size":     null,             null = no cap
      "threads":                 8,             clamped to available CPUs and to
                                                clusters/2000, so a smaller box or cohort
                                                silently uses fewer
      "top":                  null              keep only the N best-ranked clusters
    }

RESPONSE
    { "ok": true, "cluster_data": [DiffSpliceEntry...],
      "junctions_by_cluster": {cluster_id: [[start, stop, p, psi_control, psi_case]...]},
      "num_controls": N, "num_cases": M, "skipped": {},
      "n_clusters_tested": 20906, "n_significant_fdr05": 7508, "truncated": false }

    When no cluster survives filtering the body is still ok, with "status": "no_clusters" and
    an empty cluster_data: that is an outcome of the groups and thresholds, not a failure.

`skipped` is empty here by construction: the screen tests every cluster that survives
filtering and reports no per-cluster status. diffSpliceLeafcutter.py fills it.

The h5 reader, the request input and the row format are shared with diffSpliceLeafcutter.py in
diffSpliceCommon.py. The cluster filter is written in each script and has to match, so that both
test the same clusters: a change to its thresholds or order has to be made in both.

The screen ranks, it does not adjudicate -- an FDR cutoff here hides clusters the exact
test would call significant. `delta_psi` is descriptive (mean of per-sample PSI), which
is what the x axis wants; only diffSpliceLeafcutter.py accounts for overdispersion.
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

# Everything below is guarded. A missing dependency has to come back as a JSON body:
# run_python discards the response on a non-zero exit and rejects on any stderr, so an
# unguarded ImportError reaches the route as an opaque failure instead of naming the
# module. The engine definitions that follow use numpy and torch at class-definition
# time, so the guard wraps the imports rather than deferring them.
try:
    import argparse
    import contextlib
    import tempfile
    from timeit import default_timer as timer

    _t_load = timer()
    import numpy as np
    import pandas as pd
    _load_seconds = timer() - _t_load

    from diffSpliceCommon import (StageTimes, _available_cpus, _encode_covariates, _read_sample_list,
                                  cluster_rows, get_intron_meta, main, read_h5_samples)

except Exception as _import_error:
    json.dump({"ok": False,
               "error": f"{type(_import_error).__name__}: {_import_error}",
               "error_type": "environment",
               "cluster_data": [], "num_controls": 0, "num_cases": 0, "skipped": {}},
              sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(0)


# Run through R rather than reimplemented in Python: diffSpliceDGE depends on edgeR's
# Cox-Reid dispersion estimation and empirical-Bayes moderation, and an approximate
# reimplementation would diverge silently. Counts are handed over as a raw int32 blob --
# writing a 1M x 200 TSV would take longer than the analysis itself.
_EDGER_R = r"""
suppressMessages(library(edgeR))
a <- commandArgs(trailingOnly=TRUE)
bin_file <- a[1]; meta_file <- a[2]; design_file <- a[3]; out_file <- a[4]
n_introns <- as.integer(a[5]); n_samples <- as.integer(a[6])
n_threads <- as.integer(a[7]); intron_out_file <- a[8]

v <- readBin(bin_file, what="integer", n=n_introns*n_samples, size=4L)
# Python writes its [samples x introns] buffer C-contiguous, which is byte-for-byte R's
# column-major [introns x samples] -- so neither side needs a transpose.
M <- matrix(v, nrow=n_introns, ncol=n_samples)
meta <- read.table(meta_file, header=TRUE, sep="\t", stringsAsFactors=FALSE,
                   quote="", comment.char="")
design <- as.matrix(read.table(design_file, header=TRUE, sep="\t"))
rownames(M) <- meta$intron

y <- DGEList(counts=M, genes=data.frame(GeneID=meta$cluster, ExonID=meta$intron,
                                        chr=meta$chr, stringsAsFactors=FALSE))
# TMM pins down one scalar per sample, so it does not need every intron. On a
# 104k x 186 matrix the full call costs ~16s and an evenly spaced 30k-row subset ~3s;
# the factors agree to <0.1, which the within-cluster contrast largely absorbs anyway.
# The stride is deterministic, so repeat runs give identical output.
TMM_SUBSET <- 30000L
if (n_introns > TMM_SUBSET) {
  idx <- unique(as.integer(seq.int(1, n_introns, length.out=TMM_SUBSET)))
  y$samples$norm.factors <- calcNormFactors(y$counts[idx, , drop=FALSE],
                                            lib.size=y$samples$lib.size)
} else {
  y <- calcNormFactors(y)
}

edger4 <- packageVersion("edgeR") >= "4.0.0"

fit_block <- function(rows) {
  yy <- y[rows, ]        # lib.size and norm.factors stay those of the whole matrix
  if (edger4) {
    # edgeR >= 4 estimates the quasi-dispersion inside glmQLFit (legacy=FALSE, the default)
    # and never reads the tagwise dispersions estimateDisp produces, so running it is pure
    # cost -- ~38s of the ~66s R stage on a 104k x 186 matrix. Dropping it leaves the
    # ranking intact (Spearman 0.9995 on -log10 p, 990/1000 top-cluster overlap).
    f <- glmQLFit(yy, design, robust=TRUE, legacy=FALSE)
  } else {
    yy <- estimateDisp(yy, design, robust=TRUE)
    f <- glmQLFit(yy, design, robust=TRUE)
  }
  ds <- diffSpliceDGE(f, coef=ncol(design), geneid="GeneID", exonid="ExonID", verbose=FALSE)
  t <- topSpliceDGE(ds, test="Simes", n=Inf)
  # the per-intron test the Simes p is combined from: each intron against the rest of its
  # cluster. Its raw p is the junction's y in the genome browser.
  e <- topSpliceDGE(ds, test="exon", n=Inf)
  list(cluster=data.frame(cluster=t$GeneID, chr=t$chr, n_junc=t$NExons, p=t$P.Value,
                          stringsAsFactors=FALSE),
       intron=data.frame(intron=e$ExonID, p=e$P.Value, stringsAsFactors=FALSE))
}

# Splitting the fit across cores is worth doing (11.6s -> 3.2s on 4 cores for a
# 87k x 186 matrix) but it is not free: glmQLFit's empirical-Bayes variance moderation
# borrows strength ACROSS rows, so each block gets its own prior. Measured against the
# single-block fit that costs almost nothing at these block sizes -- Spearman 1.000000
# at 4 blocks, 0.999999 at 8, identical FDR<0.05 sets, max |dp| 4.7e-3 -- but the blocks
# must stay large, which is why the thread count is capped rather than scaled up freely.
if (n_threads > 1) {
  # clusters occupy contiguous row ranges (the h5 stores introns sorted by cluster and the
  # filter preserves that order), so cutting on cluster boundaries keeps every cluster whole
  ends <- cumsum(rle(meta$cluster)$lengths)
  targets <- seq_len(n_threads - 1L) * (n_introns / n_threads)
  cuts <- unique(c(0L, ends[pmin(findInterval(targets, ends) + 1L, length(ends))], n_introns))
  blocks <- lapply(seq_len(length(cuts) - 1L), function(k) (cuts[k] + 1L):cuts[k + 1L])
  parts <- parallel::mclapply(blocks, fit_block, mc.cores=min(n_threads, length(blocks)))
  bad <- !vapply(parts, function(x) is.list(x) && is.data.frame(x$cluster), logical(1))
  if (any(bad)) stop("block ", which(bad)[1], " failed: ", parts[[which(bad)[1]]])
  res <- do.call(rbind, lapply(parts, `[[`, "cluster"))
  intron_res <- do.call(rbind, lapply(parts, `[[`, "intron"))
} else {
  part <- fit_block(seq_len(n_introns))
  res <- part$cluster
  intron_res <- part$intron
}
write.table(intron_res, intron_out_file, sep="\t", quote=FALSE, row.names=FALSE)

# BH over every cluster, not per block -- this is what topSpliceDGE does internally, so
# the single- and multi-block paths adjust identically.
res$fdr <- p.adjust(res$p, method="BH")
res <- res[order(res$p), ]
write.table(res, out_file, sep="\t", quote=FALSE, row.names=FALSE)
cat(sprintf("edgeR: %d clusters tested, %d at FDR<0.05%s\n", nrow(res), sum(res$fdr < 0.05),
            if (n_threads > 1) sprintf(" [%d blocks]", length(blocks)) else ""))
"""

def group_mean_psi(sub, widths, n1, block=2048):
    """Group-mean PSI per intron, straight from the counts -- no model.

    PSI is a within-cluster proportion, so its denominator is the sum over the introns the
    cluster actually KEPT; an intron dropped by the filter must leave the denominator too,
    or every PSI in that cluster is wrong. Samples with no coverage in a cluster contribute
    nothing to that cluster, matching the rule the fit uses.

    Averaging is mean-of-ratios (every sample counts once), not pooled sums. Checked
    against `run`'s model-based deltapsi on a 1972-sample cohort: mean-of-ratios reaches
    Pearson 0.94 / Spearman 0.93 where the depth-weighted pooled version manages 0.78, and
    the sign agrees on 100% of introns once |deltapsi| >= 0.05.

    `sub` is [samples x kept introns], `widths` the kept intron count per cluster in order.
    The ratio matrix is built a block of clusters at a time: materialising it whole would
    be 3.4 GB on a 2000-sample, 210k-intron screen.
    """
    I = sub.shape[1]
    bounds = np.concatenate([[0], np.cumsum(widths)]).astype(np.int64)
    g1m = np.full(I, np.nan)
    g2m = np.full(I, np.nan)
    C = len(widths)
    for c0 in range(0, C, block):
        c1 = min(C, c0 + block)
        s0, s1 = int(bounds[c0]), int(bounds[c1])
        y = sub[:, s0:s1].astype(np.float32)
        w = widths[c0:c1]
        tot = np.repeat(np.add.reduceat(y, bounds[c0:c1] - s0, axis=1), w, axis=1)
        ok = tot > 0
        r = np.where(ok, y / np.where(tot == 0, 1, tot), 0.0)
        for dst, sl in ((g1m, slice(0, n1)), (g2m, slice(n1, None))):
            n = ok[sl].sum(0)
            np.divide(r[sl].sum(0), n, out=dst[s0:s1], where=n > 0)
    return g1m, g2m

def leafcutter_cluster_filter(buf, cluster_starts, n_group1, min_coverage=20,
                              min_samples_per_intron=5, min_samples_per_group=3,
                              max_cluster_size=float('inf')):
    """
    Vectorised version of the per-cluster filters in task(), so the screen tests the same
    cluster set leafcutter would.

    This is about power, not just consistency. leafcutter typically tests ~7% of clusters;
    screening all of them makes the BH threshold at a given rank ~15x stricter, which costs
    real sensitivity on the clusters that do carry signal. It also stops the screen from
    surfacing clusters the drill-down would refuse to test.

    Returns (keep_introns, keep_clusters) boolean masks.
    """
    starts = cluster_starts[:-1]
    sizes = np.diff(cluster_starts)
    # task() checks max_cluster_size FIRST, against the raw intron count -- before any
    # coverage or per-intron filtering -- so it is applied to `sizes`, not to the survivors.
    ok_size = (sizes >= 2) & (sizes <= max_cluster_size)
    tot = np.add.reduceat(buf, starts, axis=1)              # [samples x clusters]
    # task() discards zero-coverage samples FIRST and applies min_coverage to what is
    # left, so a sample with no reads in this cluster must not count toward
    # min_samples_per_group. Testing `tot >= min_coverage` against every sample agrees
    # with that for any positive threshold but not at min_coverage = 0, where it is true
    # for the very samples the per-cluster path has already dropped.
    covered = (tot > 0) & (tot >= min_coverage)
    ok_cov = ((tot > 0).sum(0) > 1) & (covered.sum(0) > 1)
    ok_grp = ((covered[:n_group1].sum(0) >= min_samples_per_group)
              & (covered[n_group1:].sum(0) >= min_samples_per_group))
    # an intron carrying any read necessarily has a non-zero cluster total, so restricting
    # to samples_to_use never changes which introns qualify
    intron_ok = (buf > 0).sum(0) >= min_samples_per_intron
    n_int_ok = np.add.reduceat(intron_ok.astype(np.int64), starts)
    keep_clusters = ok_size & ok_cov & ok_grp & (n_int_ok >= 2)
    keep_introns = intron_ok & np.repeat(keep_clusters, np.diff(cluster_starts))
    return keep_introns, keep_clusters


def cmd_screen(args, return_data=False, stages=None):
    import shutil
    import subprocess
    import tempfile

    stages = stages or StageTimes(0)
    t0 = timer()
    rscript = shutil.which("Rscript")
    if rscript is None:
        raise RuntimeError(
            "Rscript not found. The screen uses edgeR::diffSpliceDGE.\n"
            "  Install R, then:  Rscript -e 'BiocManager::install(\"edgeR\")'\n"
            "  (`run --genome-wide` needs no R, but takes minutes rather than seconds.)")

    g1 = _read_sample_list(args.group1)
    g2 = _read_sample_list(args.group2)
    both = set(g1) & set(g2)
    if both:
        raise ValueError(f"{len(both)} sample(s) in both groups, e.g. {sorted(both)[:5]}")
    samples = g1 + g2
    print(f"Group '{args.name1}': {len(g1)} samples;  group '{args.name2}': {len(g2)} samples")

    buf, intron_ids, cluster_ids, cluster_starts, cluster_genes = read_h5_samples(
        args.h5, samples, prefetch=(False if args.no_prefetch else "auto"))
    print(f"  {buf.shape[1]} introns, {len(cluster_ids)} clusters  [{timer()-t0:.1f}s]")
    stages.mark("read_h5")

    if args.no_leafcutter_filter:
        nz = buf.sum(0) > 0
        n_nz = np.add.reduceat(nz.astype(np.int64), cluster_starts[:-1])
        keep_clu = n_nz >= 2
        keep = nz & np.repeat(keep_clu, np.diff(cluster_starts))
        print("  --no-leafcutter-filter: screening every cluster with >=2 non-empty junctions")
    else:
        keep, keep_clu = leafcutter_cluster_filter(
            buf, cluster_starts, len(g1), min_coverage=args.min_coverage,
            min_samples_per_intron=args.min_samples_per_intron,
            min_samples_per_group=args.min_samples_per_group,
            max_cluster_size=args.max_cluster_size)
    print(f"  after filtering: {int(keep.sum())} introns in {int(keep_clu.sum())} clusters "
          f"(of {len(cluster_ids)})")
    stages.mark("filter")
    if keep.sum() == 0:
        if return_data:
            return None              # handle() reports this as status "no_clusters"
        raise ValueError("nothing left to screen after filtering")

    clu_of_intron = np.repeat(cluster_ids, np.diff(cluster_starts))
    sub = buf[:, keep]
    chrom = np.array([i.split(':')[0] for i in intron_ids[keep]])

    # design: covariates first, group LAST, so the group coefficient is the final column
    cols = {"intercept": np.ones(len(samples))}
    if args.covariates:
        cov = _encode_covariates(args.covariates, samples)
        for j, c in enumerate(cov.columns):
            cols[f"cov{j+1}"] = cov[c].to_numpy(dtype=float)
        print(f"  design includes {cov.shape[1]} covariate column(s)")
    cols["grp"] = np.array([0.0] * len(g1) + [1.0] * len(g2))
    design = pd.DataFrame(cols)

    tmp = tempfile.mkdtemp(prefix="lcds_screen_")
    try:
        binf = os.path.join(tmp, "counts.bin")
        np.ascontiguousarray(sub, dtype=np.int32).tofile(binf)
        pd.DataFrame({"intron": intron_ids[keep], "cluster": clu_of_intron[keep],
                      "chr": chrom}).to_csv(os.path.join(tmp, "meta.tsv"),
                                            sep="\t", index=False)
        design.to_csv(os.path.join(tmp, "design.tsv"), sep="\t", index=False)
        rfile = os.path.join(tmp, "edger.R")
        with open(rfile, "w") as fh:
            fh.write(_EDGER_R)
        outf = os.path.join(tmp, "out.tsv")
        intron_outf = os.path.join(tmp, "intron_out.tsv")

        nthr = max(1, int(args.num_threads))
        avail = _available_cpus()
        if nthr > avail:
            print(f"  --threads {nthr} exceeds the {avail} CPU(s) available; using {avail}")
            nthr = avail
        # Blocks must stay large enough for the empirical-Bayes moderation inside each one
        # to be well determined; below ~2000 clusters per block the priors start to drift.
        max_by_size = max(1, int(keep_clu.sum()) // 2000)
        if nthr > max_by_size:
            print(f"  only {int(keep_clu.sum())} clusters to test; using {max_by_size} thread(s) "
                  f"to keep each block large enough for the variance moderation")
            nthr = max_by_size

        stages.mark("prepare_input")
        print(f"Running edgeR diffSpliceDGE{f' on {nthr} threads' if nthr > 1 else ''}...")
        t_r = timer()
        # edgeR fits one small GLM per intron, so a threaded BLAS buys nothing (measured:
        # 11.6s on 1 BLAS thread vs 11.7s on 8) and only risks oversubscribing the cores
        # mclapply is already using. Leave an explicit user setting alone.
        env = dict(os.environ)
        for v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
                  "VECLIB_MAXIMUM_THREADS"):
            env.setdefault(v, "1")
        res = subprocess.run(
            [rscript, "--vanilla", rfile, binf, os.path.join(tmp, "meta.tsv"),
             os.path.join(tmp, "design.tsv"), outf, str(sub.shape[1]), str(sub.shape[0]),
             str(nthr), intron_outf],
            capture_output=True, text=True, env=env)
        if res.returncode != 0:
            raise RuntimeError("edgeR failed:\n" + (res.stderr or res.stdout)[-2000:])
        print("  " + res.stdout.strip().replace("\n", "\n  ") + f"  [{timer()-t_r:.1f}s]")
        out = pd.read_table(outf)
        intron_p = pd.read_table(intron_outf)
        stages.mark("edger")
    finally:
        import shutil as _sh
        _sh.rmtree(tmp, ignore_errors=True)

    # Effect size for the volcano's x axis. diffSpliceDGE reports only evidence, but
    # deltaPSI needs no model at all -- it is a descriptive property of the counts, which
    # are already in memory. Reported per cluster as the signed deltaPSI of its largest
    # |deltaPSI| intron, the junction that carries the cluster's shift.
    widths = np.add.reduceat(keep.astype(np.int64), cluster_starts[:-1])
    kept_clu = cluster_ids[widths > 0]
    widths = widths[widths > 0]
    t_ps = timer()
    psi1, psi2 = group_mean_psi(sub, widths, len(g1))
    dpsi = psi2 - psi1
    ci = np.repeat(np.arange(len(widths)), widths)
    order = np.lexsort((-np.abs(np.nan_to_num(dpsi)), ci))
    firsts = np.concatenate([[0], np.flatnonzero(np.diff(ci[order])) + 1])
    top = order[firsts]                      # per cluster, its largest-|deltaPSI| intron
    # Genomic span of each cluster: its introns' leftmost start and rightmost end. The
    # volcano's drill-down opens a violin at chr/start/stop, so it travels with the row.
    km = get_intron_meta(intron_ids[keep])
    ci_s = pd.Series(np.repeat(np.arange(len(widths)), widths))
    span = pd.DataFrame({"chr": km["chr"].to_numpy(),
                         "start": km["start"].astype(np.int64).to_numpy(),
                         "stop": km["end"].astype(np.int64).to_numpy()}).groupby(ci_s).agg(
        {"chr": "first", "start": "min", "stop": "max"})

    eff = pd.DataFrame({"cluster": kept_clu,
                        "chr_": span["chr"].to_numpy(),
                        "start": span["start"].to_numpy(),
                        "stop": span["stop"].to_numpy(),
                        "deltapsi": dpsi[top],
                        "top_intron": intron_ids[keep][top],
                        f"psi_{args.name1}": psi1[top],
                        f"psi_{args.name2}": psi2[top]})
    out = out.merge(eff, on="cluster", how="left")
    print(f"  effect sizes from counts [{timer()-t_ps:.1f}s]")

    # Every tested junction, for showing a cluster's junctions in the genome browser.
    # intron ids hold 1-based coordinates of the last base of the left exon and the first
    # base of the right exon.
    junctions = pd.DataFrame({"intron": intron_ids[keep],
                              "cluster": km["chr"].to_numpy() + ":" + clu_of_intron[keep],
                              "start": km["start"].astype(np.int64).to_numpy() - 1,
                              "stop": km["end"].astype(np.int64).to_numpy() - 1,
                              "psi_control": psi1,
                              "psi_case": psi2}).merge(intron_p, on="intron", how="inner")

    gene_of = dict(zip(cluster_ids, cluster_genes))
    out.insert(1, "genes", [gene_of.get(c, "") or np.nan for c in out.cluster])
    out["cluster"] = out["chr"] + ":" + out["cluster"]
    out = out.drop(columns=["chr"]).rename(columns={"chr_": "chr"})
    stages.mark("effect_size")
    if return_data:
        return out, junctions
    out.to_csv(args.output_prefix + "_screen.txt", sep="\t", index=False, na_rep="NA")
    print(f"Done in {timer()-t0:.1f}s -> {args.output_prefix}_screen.txt")
    print("  Ranked screen. Use the ranking, not an FDR cutoff, to decide what to show:\n"
          "  a cutoff here hides clusters leafcutter would call significant. Drill into a\n"
          "  hit with:  run --gene <GENE>\n"
          "  Volcano: deltapsi on x, -log10(p) on y. deltapsi is descriptive (mean of\n"
          "  per-sample PSI), not the model-based estimate `run` reports -- they track\n"
          "  each other closely but only `run` accounts for overdispersion.")


def junctions_by_cluster(junctions, cluster_ids):
    """Junction table -> {cluster id: [[start, stop, p, psi_control, psi_case], ...]}.

    Arrays rather than objects, and rounded (p to 4 significant digits, PSI to 4 decimals),
    since a screen carries ~100k junctions: this halves them to ~4.4 MB on a 100v100 AML run.
    Coordinates are already in the junction track's convention, see cmd_screen().
    """
    def psi(v):
        return round(float(v), 4) if np.isfinite(v) else None

    out = {}
    for r in junctions.itertuples(index=False):
        if r.cluster not in cluster_ids or not np.isfinite(r.p):
            continue
        out.setdefault(r.cluster, []).append(
            [int(r.start), int(r.stop), float(f"{r.p:.4g}"), psi(r.psi_control), psi(r.psi_case)])
    return out


def handle(req):
    stages = StageTimes(_load_seconds)

    def field(key, default=None, required=False, cast=None):
        v = req.get(key)
        if v is None:
            if required:
                raise ValueError(f"missing required field: {key!r}")
            return default
        return cast(v) if cast else v

    group1 = field("group1", required=True)
    group2 = field("group2", required=True)
    max_cluster = field("max_cluster_size")
    args = argparse.Namespace(
        h5=field("h5", required=True, cast=str),
        group1=group1,
        group2=group2,
        name1="control",
        name2="case",
        covariates=field("covariates"),
        min_coverage=field("min_coverage", 20, cast=int),
        min_samples_per_intron=field("min_samples_per_intron", 5, cast=int),
        min_samples_per_group=field("min_samples_per_group", 3, cast=int),
        max_cluster_size=float("inf") if max_cluster is None else int(max_cluster),
        num_threads=field("threads", 8, cast=int),
        no_leafcutter_filter=False,
        no_prefetch=False,
        output_prefix=None,
    )
    if args.num_threads < 1:
        raise ValueError("threads must be >= 1")

    res = cmd_screen(args, return_data=True, stages=stages)
    if res is None:
        return {
            "status": "no_clusters",
            "cluster_data": [],
            "junctions_by_cluster": {},
            "num_controls": len(_read_sample_list(group1)),
            "num_cases": len(_read_sample_list(group2)),
            "skipped": {},
            "n_clusters_tested": 0,
            "n_significant_fdr05": 0,
            "truncated": False,
            "timings": stages.report(),
        }
    out, junctions = res
    n_tested = len(out)
    n_sig = int((out["fdr"] < 0.05).sum())

    top = field("top", cast=int)
    truncated = bool(top is not None and n_tested > top)
    if truncated:
        out = out.head(top)

    body = {
        "cluster_data": cluster_rows(out, "control", "case"),
        "junctions_by_cluster": junctions_by_cluster(junctions, set(out["cluster"])),
        "num_controls": len(_read_sample_list(group1)),
        "num_cases": len(_read_sample_list(group2)),
        "skipped": {},
        "n_clusters_tested": n_tested,
        "n_significant_fdr05": n_sig,
        "truncated": truncated,
    }
    stages.mark("format_output")
    body["timings"] = stages.report()
    return body

if __name__ == "__main__":
    raise SystemExit(main(handle))
