#!/usr/bin/env python3
"""Self-check for query_element_values.py. Run directly: python3 test_query_element_values.py

Builds a tiny synthetic element HDF5 in a temp dir rather than reading a cohort matrix, so
the check is runnable anywhere and asserts on values it knows exactly.

Covers the logic that is not obvious by reading:
  - half-open overlap (an element touching the query edge counts; one abutting it does not)
  - element-ID lookup, including an unknown ID being skipped rather than fatal
  - element_class restriction
  - the promoter-only ID fallback (meta/promoter/promoterID, no meta/element group)
  - a requested sample absent from the matrix yielding a null column in the right position
  - NaN in the matrix surfacing as null
"""

import os
import tempfile

import h5py
import numpy as np

from query_element_values import parse_query, query


def write_h5(path, ids, chrs, starts, stops, values, classes=None, promoter_only=False):
    with h5py.File(path, 'w') as h:
        st = h5py.string_dtype(encoding='utf-8')
        h.create_group('beta').create_dataset('values', data=np.array(values, dtype='float32'))
        meta = h.create_group('meta')
        meta.create_dataset('chr', data=np.array(chrs, dtype=st))
        meta.create_dataset('start', data=np.array(starts))
        meta.create_dataset('stop', data=np.array(stops))
        meta.create_dataset('gene_names', data=np.array(['G%d' % i for i in range(len(ids))], dtype=st))
        if promoter_only:
            # Original layout: no meta/element group at all.
            meta.create_group('promoter').create_dataset('promoterID', data=np.array(ids, dtype=st))
        else:
            meta.create_group('element').create_dataset('elementID', data=np.array(ids, dtype=st))
            if classes is not None:
                meta.create_dataset('element_class', data=np.array(classes, dtype=st))
        meta.create_group('samples').create_dataset('names', data=np.array(['s1', 's2'], dtype=st))


def main():
    # parse_query
    assert parse_query('chr1:100-200') == {'type': 'range', 'chrom': 'chr1', 'start': 100, 'stop': 200}
    assert parse_query('chr1:100')['stop'] == 101, 'a point query must span 1 bp, not 0'
    assert parse_query('chr1:1,000-2,000')['start'] == 1000, 'commas in coordinates must be tolerated'
    assert parse_query('EH38E1,EH38E2') == {'type': 'ids', 'ids': ['EH38E1', 'EH38E2']}

    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'el.h5')
        write_h5(
            p,
            ids=['E1', 'E2', 'E3'],
            chrs=['chr1', 'chr1', 'chr2'],
            starts=[100, 300, 100],
            stops=[200, 400, 200],
            values=[[1.0, 2.0], [3.0, np.nan], [5.0, 6.0]],
            classes=['promoter', 'enhancer_distal', 'promoter'],
        )

        # Half-open overlap: [100,200) vs query [150,300) overlaps; [300,400) abuts at 300 and
        # must NOT be returned, which is the boundary a naive <= would get wrong.
        r = query(p, ['s1', 's2'], 'chr1:150-300')
        assert [x['id'] for x in r['rows']] == ['E1'], r['rows']

        # Widen by one base and the abutting element joins.
        r = query(p, ['s1', 's2'], 'chr1:150-301')
        assert [x['id'] for x in r['rows']] == ['E1', 'E2'], r['rows']

        # Chromosome is part of the match: E3 shares coordinates with E1 but sits on chr2.
        r = query(p, ['s1', 's2'], 'chr2:100-200')
        assert [x['id'] for x in r['rows']] == ['E3'], r['rows']

        # NaN becomes null, not 0.0 -- a 0 M-value is a real, meaningful methylation level.
        r = query(p, ['s1', 's2'], 'E2')
        assert r['values'] == [[3.0, None]], r['values']

        # Unknown ID is skipped, known one still answers.
        r = query(p, ['s1', 's2'], 'E1,NOPE')
        assert [x['id'] for x in r['rows']] == ['E1'], r['rows']

        # A sample missing from the matrix is a null column, and the surviving values stay in
        # the caller's requested positions rather than shifting left.
        r = query(p, ['s1', 'ghost', 's2'], 'E1')
        assert r['values'] == [[1.0, None, 2.0]], r['values']

        # element_class restriction
        r = query(p, ['s1', 's2'], 'chr1:1-100000', element_class='enhancer_distal')
        assert [x['id'] for x in r['rows']] == ['E2'], r['rows']

        # No match is an empty answer, not an exception.
        assert query(p, ['s1'], 'chr1:1-2') == {'rows': [], 'values': []}

        # Promoter-only layout: IDs resolve through the fallback path, and class is null.
        p2 = os.path.join(d, 'prom.h5')
        write_h5(
            p2,
            ids=['P1'],
            chrs=['chr1'],
            starts=[100],
            stops=[200],
            values=[[7.0, 8.0]],
            promoter_only=True,
        )
        r = query(p2, ['s1', 's2'], 'chr1:150-160')
        assert r['rows'][0]['id'] == 'P1' and r['rows'][0]['class'] is None, r['rows']
        assert r['values'] == [[7.0, 8.0]], r['values']

    print('all query_element_values checks passed')


if __name__ == '__main__':
    main()
