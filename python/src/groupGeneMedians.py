import json
import sys

import h5py
import numpy as np

# Median expression of every gene in each of several sample groups, from a gene expression HDF5 file
# (datasets item, samples, matrix of genes x samples). Two numbers per gene per group come back instead of the
# matrix, which is what the DMR scan needs to ask whether the genes near a DMR are expressed in either group.
#
# Input JSON on stdin:  {"input_file": "<h5>", "groups": [["sampleA", ...], ["sampleB", ...]]}
# Output JSON:          {"genes": [...], "medians": [[group 1 medians], [group 2 medians]], "samples": [n1, n2]}
# Sample names absent from the file are ignored; a group left with none is an error.
# With "values_min": m, also "values": {"genes": [...], "samples": [[names of group 1], [group 2]],
# "data": [[gene-major values of group 1], [group 2]]}: each sample's value for every gene whose median reaches m in
# either group, for relating expression to something measured per sample.
#
# echo '{"input_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5","groups":[["2646","2660","2898"],["3150","3178","3206"]]}' | python python/src/groupGeneMedians.py

# rows read at once, so a large cohort is never held as one float64 matrix
CHUNK_ROWS = 2000


def group_medians(filename: str, groups: list[list[str]], values_min: float | None = None) -> dict:
    with h5py.File(filename, "r") as h:
        genes = h["item"].asstr()[:]
        col = {s: i for i, s in enumerate(h["samples"].asstr()[:])}
        idx = [sorted({col[s] for s in g if s in col}) for g in groups]
        for k, ix in enumerate(idx):
            if not ix:
                raise ValueError(f"group {k + 1} has no sample in the expression file")
        # h5py reads only increasing column indices; read the union once, then split it per group
        union = sorted(set().union(*idx))
        pos = {c: j for j, c in enumerate(union)}
        sel = [[pos[c] for c in ix] for ix in idx]
        matrix = h["matrix"]
        medians: list[list[float]] = [[] for _ in groups]
        kept_genes: list[str] = []
        data: list[list[float]] = [[] for _ in groups]
        for start in range(0, matrix.shape[0], CHUNK_ROWS):
            block = np.asarray(matrix[start : start + CHUNK_ROWS, union], dtype=float)
            meds = [np.nanmedian(block[:, s], axis=1) for s in sel]
            for k in range(len(sel)):
                medians[k].extend(np.round(meds[k], 4).tolist())
            if values_min is not None:
                keep = np.nanmax(np.vstack(meds), axis=0) >= values_min
                kept_genes.extend(genes[start : start + CHUNK_ROWS][keep].tolist())
                for k, s in enumerate(sel):
                    data[k].extend(np.round(block[keep][:, s], 3).ravel().tolist())
        out = {"genes": genes.tolist(), "medians": medians, "samples": [len(ix) for ix in idx]}
        if values_min is not None:
            names = h["samples"].asstr()[:]
            out["values"] = {"genes": kept_genes, "samples": [names[ix].tolist() for ix in idx], "data": data}
    return out


def main() -> int:
    try:
        args = json.loads(sys.stdin.read())
        groups = args.get("groups")
        if not isinstance(groups, list) or len(groups) < 1 or not all(isinstance(g, list) for g in groups):
            raise ValueError("groups must be a list of sample-name lists")
        vm = args.get("values_min")
        out = group_medians(args["input_file"], [[str(s) for s in g] for g in groups], None if vm is None else float(vm))
        # a gene with no finite value in a group has a NaN median, which JSON cannot carry
        out["medians"] = [[None if v != v else v for v in m] for m in out["medians"]]
        if "values" in out:
            out["values"]["data"] = [[None if v != v else v for v in m] for m in out["values"]["data"]]
        print(json.dumps(out))
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
