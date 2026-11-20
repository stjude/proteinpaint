import json
import sys

import h5py
import numpy as np

# Each gene's median value across every sample of a gene expression HDF5 file (datasets item, samples, matrix of
# genes x samples), read in row chunks so memory stays flat. The GSEA route bins genes by it to take expression level
# out of a methylation ranking; a bin is a quantile of rank, so the file's unit (TPM, log) does not matter.
#
#   echo '{"input_file":"server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5"}' | python python/src/geneMedians.py
#   -> {"<gene>": <median>, ...}, genes whose median is not a number left out


def gene_medians(filename: str) -> dict:
	out = {}
	with h5py.File(filename, 'r') as h:
		genes = h['item'].asstr()[:]
		matrix = h['matrix']
		rows = max(1, 400_000 // matrix.shape[1])
		for start in range(0, matrix.shape[0], rows):
			med = np.nanmedian(np.asarray(matrix[start:start + rows], dtype=float), axis=1)
			for g, m in zip(genes[start:start + rows], med):
				if np.isfinite(m):
					out[g] = float(m)
	return out


if __name__ == '__main__':
	try:
		print(json.dumps(gene_medians(json.loads(sys.stdin.read())['input_file'])))
	except Exception as e:
		print(f'Error: {e}', file=sys.stderr)
		sys.exit(1)
