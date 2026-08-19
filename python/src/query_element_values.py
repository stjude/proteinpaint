"""
Query an element-level DNA methylation matrix (promoters, cCREs, eQTM blocks).

Why this exists separately from query_beta_values.py:
    query_beta_values.py serves the CpG/probe-level matrix. Its two lookup paths both
    depend on structures that an element matrix does not have -- the genomic path reads
    the `chrom_lengths` root attribute to find a chromosome's row span, and the CpG path
    reads /meta/probe/probeID. createHdf5ForDnaMeth.py --format promoter writes neither.
    An element matrix instead carries per-row coordinates (/meta/chr, /meta/start,
    /meta/stop) and a row identifier under /meta/element/elementID (new builds) or
    /meta/promoter/promoterID (original promoter-only builds), so rows are located by
    scanning those coordinate vectors rather than by a precomputed chromosome index.

    Rows are already aggregated: one row is one element, and the value is the
    coverage-weighted summary that build_element_matrix.py produced. There is no
    per-CpG detail to recover here.

HDF5 layout consumed (see createHdf5ForDnaMeth.py --format promoter):
    /beta/values                {n_elements, n_samples}  float32
    /meta/chr                   {n_elements}             str
    /meta/start                 {n_elements}             int    (0-based)
    /meta/stop                  {n_elements}             int    (exclusive)
    /meta/gene_names            {n_elements}             str
    /meta/element/elementID     {n_elements}             str    (preferred)
    /meta/promoter/promoterID   {n_elements}             str    (fallback)
    /meta/element_class         {n_elements}             str    (optional)
    /meta/samples/names         {n_samples}              str

Input (stdin JSON, or CLI flags):
    h : path to the element HDF5
    s : comma-separated sample names; output column order matches this exactly
    q : either a genomic range "chr1:100-200" (all OVERLAPPING elements) or a
        comma-separated list of element IDs ("EH38E2776539,EH38E2776540")
    c : (optional) element_class to restrict to, e.g. "promoter" or "enhancer_distal".
        Ignored when the matrix carries no /meta/element_class.

Output: JSON object
    {
      "rows": [ {"id","chr","start","stop","gene_names","class"}, ... ],
      "values": [[v, v, ...], ...]        # n_matched_rows x n_query_samples
    }
    Missing values are null. A sample not present in the matrix yields a null column.
    An empty "rows" is a valid answer (query matched no element), not an error --
    the caller decides whether that is a problem.

    Note the shape differs from query_beta_values.py, which returns a bare matrix. Row
    identity matters here: one row is a named element the user selected, not one of many
    anonymous CpGs to be averaged, so the caller needs to know which elements answered.

Example:
    echo '{"h":"allccre_avg_mval.h5","s":"a,b","q":"chr1:778000-779000"}' \
        | python query_element_values.py
"""

import argparse
import json
import re
import sys

import h5py
import numpy as np

# Accepts chr1:100-200 and chr1:100 (a point, treated as a 1-bp span).
GENOMIC_RE = re.compile(r'^(chr[0-9A-Za-z_]+):([\d,]+)(?:-([\d,]+))?$', re.IGNORECASE)


def parse_query(query_string):
    """Classify the query as a genomic range or a list of element IDs.

    Range wins when the string matches the coordinate shape. Element IDs are not
    constrained to a pattern (ENCODE cCREs are EH38E..., but eQTM block IDs are
    builder-defined), so anything that is not a range is treated as an ID list rather
    than validated against a regex that would reject a future ID scheme.
    """
    m = GENOMIC_RE.match(query_string.strip())
    if m:
        start = int(m.group(2).replace(',', ''))
        stop = int(m.group(3).replace(',', '')) if m.group(3) else start + 1
        if start > stop:
            raise ValueError(f'Start position ({start}) > end position ({stop})')
        return {'type': 'range', 'chrom': m.group(1), 'start': start, 'stop': stop}
    ids = [t.strip() for t in query_string.split(',') if t.strip()]
    if not ids:
        raise ValueError(f"Could not parse query: '{query_string}'")
    return {'type': 'ids', 'ids': ids}


def read_str(h5, path):
    return h5[path].asstr()[:]


def resolve_row_ids(h5):
    """Row identifiers, trying the generic layout before the promoter-only one.

    Mirrors the resolution order in diffMeth.R: existing promoter H5 files predate
    /meta/element/elementID, so the promoter-specific path is tried last and those files
    keep working untouched.
    """
    if 'meta/element/elementID' in h5:
        return read_str(h5, 'meta/element/elementID')
    if 'meta/element_id' in h5:
        return read_str(h5, 'meta/element_id')
    if 'meta/promoter/promoterID' in h5:
        return read_str(h5, 'meta/promoter/promoterID')
    raise KeyError('no element ID dataset found (tried meta/element/elementID, meta/element_id, meta/promoter/promoterID)')


def select_rows(h5, parsed, element_class):
    """Row indices matching the query, in ascending order.

    Ascending order is not cosmetic: h5py fancy-indexing requires an increasing index
    list, and reading in file order keeps the access within as few chunks as possible.
    For an ID query the caller's ordering is restored afterwards by the row metadata that
    travels with each returned row, so sorting here loses nothing.
    """
    ids = resolve_row_ids(h5)

    if parsed['type'] == 'ids':
        id2row = {v: i for i, v in enumerate(ids)}
        idx = [id2row[q] for q in parsed['ids'] if q in id2row]
    else:
        chrs = read_str(h5, 'meta/chr')
        starts = h5['meta/start'][:]
        stops = h5['meta/stop'][:]
        # Half-open overlap on both sides: an element counts if any base is shared with
        # the query span. Using strict containment instead would silently drop the
        # element a user is pointing at whenever they paste a gene's coordinates.
        hit = (chrs == parsed['chrom']) & (starts < parsed['stop']) & (stops > parsed['start'])
        idx = np.nonzero(hit)[0].tolist()

    if element_class and 'meta/element_class' in h5:
        classes = read_str(h5, 'meta/element_class')
        idx = [i for i in idx if classes[i] == element_class]

    return sorted(set(idx))


def query(h5_file, sample_names, query_string, element_class=None):
    parsed = parse_query(query_string)

    with h5py.File(h5_file, 'r') as h5:
        all_samples = read_str(h5, 'meta/samples/names')
        name2col = {n: i for i, n in enumerate(all_samples)}
        # A requested sample missing from this matrix is normal, not an error: the
        # methylation cohort is a subset of the dataset's samples. It becomes a null
        # column so the caller's sample order is still positionally valid.
        col_idx = [name2col.get(n, -1) for n in sample_names]

        row_idx = select_rows(h5, parsed, element_class)
        if not row_idx:
            return {'rows': [], 'values': []}

        chrs = read_str(h5, 'meta/chr')
        starts = h5['meta/start'][:]
        stops = h5['meta/stop'][:]
        genes = read_str(h5, 'meta/gene_names')
        ids = resolve_row_ids(h5)
        classes = read_str(h5, 'meta/element_class') if 'meta/element_class' in h5 else None

        dset = h5['beta/values']
        # Read whole rows and subset columns in numpy. Slicing both axes in h5py would
        # need a second fancy index, and the row is only n_samples wide (415 here), so
        # the full read costs nothing next to locating the chunk.
        block = dset[row_idx, :]

        valid = [c for c in col_idx if c >= 0]
        sub = block[:, valid] if valid else np.empty((len(row_idx), 0), dtype='float32')

        values = []
        for r in range(len(row_idx)):
            out, k = [], 0
            for c in col_idx:
                if c < 0:
                    out.append(None)
                else:
                    v = float(sub[r, k])
                    out.append(None if np.isnan(v) else v)
                    k += 1
            values.append(out)

        rows = [
            {
                'id': str(ids[i]),
                'chr': str(chrs[i]),
                'start': int(starts[i]),
                'stop': int(stops[i]),
                'gene_names': str(genes[i]),
                'class': str(classes[i]) if classes is not None else None,
            }
            for i in row_idx
        ]
        return {'rows': rows, 'values': values}


def get_inputs():
    """stdin JSON first, CLI flags as the fallback -- same contract as
    query_beta_values.py, so both scripts are driven identically from the server."""
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            j = json.loads(raw)
            return j['h'], j['s'], j['q'], j.get('c')
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--h', required=True, help='path to element HDF5')
    p.add_argument('--s', required=True, help='comma-separated sample names')
    p.add_argument('--q', required=True, help='genomic range or element ID list')
    p.add_argument('--c', default=None, help='element_class to restrict to')
    a = p.parse_args()
    return a.h, a.s, a.q, a.c


def main():
    h5_file, samples, q, element_class = get_inputs()
    sample_names = [s.strip() for s in samples.split(',') if s.strip()]
    if not sample_names:
        raise ValueError('no sample names given')
    print(json.dumps(query(h5_file, sample_names, q, element_class)))


if __name__ == '__main__':
    main()
