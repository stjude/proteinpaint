"""
Generate a small fixture HDF5 file for diffMeth.R tests.
Structure matches the real promoter H5 format from createHdf5ForDnaMeth.py --format promoter.

Creates 20 promoters x 10 samples with known M-value patterns:
- Promoters 0-4: strong differential methylation (case >> control)
- Promoters 5-9: strong differential methylation (control >> case)
- Promoters 10-14: no differential methylation (similar values)
- Promoters 15-17: edge cases (low variance, some NAs)
- Promoters 18-19: all NA in one group (should be filtered out)

Samples: 5 case (case_1..case_5), 5 control (ctrl_1..ctrl_5)

Usage: python create_diffMeth_fixture.py
"""

import numpy as np
import h5py
import os

np.random.seed(42)  # Reproducible

n_promoters = 20
n_samples = 10
case_names = [f"case_{i}" for i in range(1, 6)]
ctrl_names = [f"ctrl_{i}" for i in range(1, 6)]
all_samples = case_names + ctrl_names

promoter_ids = [f"EH38E_TEST_{i:04d}" for i in range(n_promoters)]
gene_names = [
    "TP53", "BRCA1", "EGFR", "MYC", "PTEN",           # 0-4: hypermethylated in case
    "RB1", "APC", "VHL", "WT1", "NF1",                  # 5-9: hypomethylated in case
    "GAPDH", "ACTB", "HPRT1", "B2M", "RPL13A",         # 10-14: no change (housekeeping)
    "LOW_VAR1", "LOW_VAR2", "SPARSE1",                   # 15-17: edge cases
    "ALLNA_CASE", "ALLNA_CTRL"                            # 18-19: should be filtered
]

# Build M-value matrix (n_promoters x n_samples)
mvalues = np.zeros((n_promoters, n_samples), dtype=np.float32)

# Promoters 0-4: case mean ~3.0, control mean ~0.0 (strong hypermethylation in case)
for i in range(5):
    mvalues[i, :5] = np.random.normal(3.0, 0.5, 5)   # cases
    mvalues[i, 5:] = np.random.normal(0.0, 0.5, 5)    # controls

# Promoters 5-9: case mean ~-1.0, control mean ~2.0 (hypomethylation in case)
for i in range(5, 10):
    mvalues[i, :5] = np.random.normal(-1.0, 0.5, 5)   # cases
    mvalues[i, 5:] = np.random.normal(2.0, 0.5, 5)     # controls

# Promoters 10-14: both groups mean ~1.0 (no differential methylation)
for i in range(10, 15):
    mvalues[i, :] = np.random.normal(1.0, 0.3, 10)

# Promoters 15-16: very low variance
mvalues[15, :] = 1.0 + np.random.normal(0, 0.01, 10)
mvalues[16, :] = -0.5 + np.random.normal(0, 0.01, 10)

# Promoter 17: has 1 NA per group (should survive filtering with min_samples=3)
mvalues[17, :5] = np.random.normal(2.0, 0.5, 5)
mvalues[17, 5:] = np.random.normal(-1.0, 0.5, 5)
mvalues[17, 2] = np.nan   # 1 NA in case group
mvalues[17, 8] = np.nan   # 1 NA in control group

# Promoter 18: all NA in case group (should be filtered out)
mvalues[18, :5] = np.nan
mvalues[18, 5:] = np.random.normal(1.0, 0.3, 5)

# Promoter 19: all NA in control group (should be filtered out)
mvalues[19, :5] = np.random.normal(1.0, 0.3, 5)
mvalues[19, 5:] = np.nan

# Metadata
starts = np.arange(n_promoters) * 10000
stops = starts + 2000
num_cpg = np.random.randint(3, 20, n_promoters)

# Write HDF5
outpath = os.path.join(os.path.dirname(__file__), "diffMeth_fixture.h5")
with h5py.File(outpath, "w") as f:
    f.create_dataset("beta/values", data=mvalues, dtype="float32")
    f.create_dataset("meta/gene_names", data=np.array(gene_names, dtype="S"))
    f.create_dataset("meta/samples/names", data=np.array(all_samples, dtype="S"))
    f.create_dataset("meta/probe/probeID", data=np.array(promoter_ids, dtype="S"))
    f.create_dataset("meta/start", data=starts)
    f.create_dataset("meta/stop", data=stops)
    f.create_dataset("meta/num_cpg_sites", data=num_cpg)

print(f"Fixture written to {outpath}")
print(f"Shape: {mvalues.shape}")
print(f"Samples: {all_samples}")
print(f"Promoters with NAs: 17 (partial), 18 (all case NA), 19 (all ctrl NA)")
