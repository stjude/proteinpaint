import base64
import contextlib
import io
import json
import os
import sqlite3
import sys
import time
import uuid

import blitzgsea as blitz
import pandas as pd

from format_time import format_elapsed_time

# Test syntax: cat ~/sjpp/test.txt | time python gsea.py
# test.txt contains the json string the Node side sends on stdin
# ('/' + JSON.stringify(input); see server/routes/genesetEnrichment.ts).
#
# Output contract with Node (server/routes/genesetEnrichment.ts): only lines
# prefixed `result: ` and `image: ` are parsed; failures are emitted on the
# `result:` channel as {"error": ...}. Any other stdout line is logged via
# mayLog. IMPORTANT: run_python() rejects the whole call if ANYTHING is
# written to stderr, so all diagnostics must go to stdout (see
# _suppressed_stderr below).

# Default (latest) Enrichr library name per client geneset_group. Keep the
# defaults in lockstep with GSEA_LIBRARY_VERSION in
# server/routes/genesetEnrichment.ts and the curated `blitzgseaVersions` list
# in client/plots/gsea.js. Staleness is watched by the nightly
# enrichr-freshness GitHub workflow (python/src/check_enrichr_freshness.py).
#
# The client may pin a specific version by appending a 3rd '--' segment, e.g.
# 'REACTOME--blitzgsea--Reactome_2022'; resolve_blitz_library() honors it and
# falls back to the default below when absent (backward compatible).
BLITZ_LIBRARIES = {
    "REACTOME--blitzgsea": "Reactome_Pathways_2024",
    "KEGG--blitzgsea": "KEGG_2026",
    "WikiPathways--blitzgsea": "WikiPathways_2024_Human",
}


def resolve_blitz_library(geneset_group):
    """Return the Enrichr library name for a blitzgsea geneset_group, or None.

    Accepts the 2-segment default form ('KEGG--blitzgsea') or the 3-segment
    versioned form ('KEGG--blitzgsea--KEGG_2021_Human'). Returns None when the
    group isn't a blitzgsea group (caller then uses the MSigDB SQLite path).
    """
    parts = geneset_group.split("--")
    base = "--".join(parts[:2])
    if base not in BLITZ_LIBRARIES:
        return None
    # 3rd segment, when present and non-empty, is the exact Enrichr library name.
    if len(parts) >= 3 and parts[2]:
        return parts[2]
    return BLITZ_LIBRARIES[base]


@contextlib.contextmanager
def _suppressed_stderr():
    """Redirect OS-level stderr (fd 2) to /dev/null for the wrapped block.

    blitzgsea's numba-compiled kernels and its multiprocessing calibration
    children emit RuntimeWarnings (divide-by-zero, empty-slice) straight to
    fd 2, bypassing Python's `warnings` filters. run_python() in
    @sjcrh/proteinpaint-python rejects the entire call if anything reaches
    stderr, so we silence fd 2 around blitz calls. Genuine failures still
    surface as exceptions (handled by _safe_blitz_gsea) or a non-zero exit.
    """
    saved_fd = os.dup(2)
    devnull_fd = os.open(os.devnull, os.O_WRONLY)
    try:
        os.dup2(devnull_fd, 2)
        yield
    finally:
        os.dup2(saved_fd, 2)
        os.close(devnull_fd)
        os.close(saved_fd)


def _safe_blitz_gsea(signature, library, permutations):
    """Friendly fallback around blitz.gsea().

    As of blitzgsea 1.3.54 the library still raises on degenerate signatures:
    ValueError (from scipy.stats.gamma.fit when calibration hits non-finite
    values — too few overlapping genes, or all-identical / all-zero
    fold-changes) and ZeroDivisionError (very small signatures). Surface a
    clean structured error to Node instead of a multi-page traceback and a
    non-zero exit. Returns the gsea result on success, or None after emitting
    an error line.
    """
    try:
        with _suppressed_stderr():
            return blitz.gsea(signature, library, permutations=permutations)
    except (ValueError, ZeroDivisionError, RuntimeError) as e:
        msg = (
            'GSEA failed: the input signature could not be calibrated by blitzgsea. '
            'This usually means too few genes overlap the selected gene-set library, '
            'or the fold-change values are degenerate (all zero / all identical). '
            f'Underlying error: {type(e).__name__}: {e}'
        )
        # Single-line JSON; the Node side parses any `result: ` line.
        print(f'result: {json.dumps({"error": msg})}')
        return None


def _load_msigdb_library(db, table_name):
    """Build {geneset_id: [unique gene symbols]} for an MSigDB geneset group.

    One parameterized query joining terms -> term2genes, replacing the prior
    per-geneset N+1 loop and f-string-interpolated SQL.
    """
    library = {}
    with contextlib.closing(sqlite3.connect(db)) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, genes FROM term2genes "
            "WHERE id IN (SELECT id FROM terms WHERE parent_id = ?)",
            (table_name,),
        )
        for geneset_id, genes_json in cursor.fetchall():
            library[geneset_id] = list({gene['symbol'] for gene in json.loads(genes_json)})
    return library


def _filter_coding_genes(signature, genedb):
    """Keep only signature rows whose gene is in the genome's codingGenes."""
    with contextlib.closing(sqlite3.connect(genedb)) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM codingGenes")
        coding_genes = {row[0] for row in cursor.fetchall()}
    return signature[signature['Genes'].isin(coding_genes)]


def main():
    # Node sends '/' + JSON.stringify(input); the leading '/' is a sentinel.
    raw = sys.stdin.read()
    if not raw.strip():
        return  # no input -> no-op
    json_object = json.loads(raw.lstrip('/'))

    cachedir = json_object['cachedir']
    table_name = json_object['geneset_group']
    db = json_object['db']

    signature = pd.DataFrame({'Genes': json_object['genes'], 'fold_change': json_object['fold_change']})

    # Resolve the gene-set library: either a blitzgsea/Enrichr library
    # (disk-cached by blitzgsea after first fetch) or an MSigDB geneset group
    # from the local SQLite db.
    blitz_library_name = resolve_blitz_library(table_name)
    if blitz_library_name:
        with _suppressed_stderr():
            gene_set_library = blitz.enrichr.get_library(blitz_library_name)
    else:
        start = time.perf_counter()
        gene_set_library = _load_msigdb_library(db, table_name)
        print(f"Library load time: {format_elapsed_time(time.perf_counter() - start)}")

    if json_object['filter_non_coding_genes']:
        signature = _filter_coding_genes(signature, json_object['genedb'])

    if 'geneset_name' in json_object:
        # Detail-image path. The server delivers the previously computed gsea
        # result inline as a base64-encoded pickle, so we never touch disk for
        # the data.
        result = pd.read_pickle(io.BytesIO(base64.b64decode(json_object['pickle_b64'])))
        with _suppressed_stderr():
            fig = blitz.plot.running_sum(
                signature, json_object['geneset_name'], gene_set_library, result=result.T, compact=True
            )
        png_filename = f"gsea_plot_{uuid.uuid4().hex}.png"
        fig.savefig(os.path.join(cachedir, png_filename), bbox_inches='tight')
        print(f'image: {json.dumps({"image_file": png_filename})}')
    else:
        # Initial-table path. We always run blitzgsea fresh — Node owns the
        # cache. Pickle the result and base64-encode it so the server can stash
        # it in the JSON envelope and feed it back on a later detail-image
        # request.
        start = time.perf_counter()
        gsea_result = _safe_blitz_gsea(signature, gene_set_library, json_object['num_permutations'])
        if gsea_result is None:
            return  # _safe_blitz_gsea already emitted the structured error
        result = gsea_result.T
        buf = io.BytesIO()
        result.to_pickle(buf)
        pickle_b64 = base64.b64encode(buf.getvalue()).decode('ascii')
        print(f'result: {json.dumps({"data": json.loads(result.to_json()), "pickle_b64": pickle_b64})}')
        print(f"GSEA time: {format_elapsed_time(time.perf_counter() - start)}")


if __name__ == "__main__":
    try:
        main()
    except (EOFError, IOError):
        pass  # Handle EOFError and IOError gracefully (e.g. closed stdin pipe)
