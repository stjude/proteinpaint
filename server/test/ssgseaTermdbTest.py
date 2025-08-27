#!/usr/bin/python3
"""
Generate TermdbTest.ssgsea.h5
"""

import numpy as np
import pandas as pd
import subprocess as sp
import sys
import sqlite3
import h5py

expressionFile = './tp/files/hg38/TermdbTest/TermdbTest.fpkm.matrix.gz' # compressed gene expression file: #chr    start   stop    gene sample...
dbfile = './tp/files/hg38/TermdbTest/msigdb/db' # msigdb


# samples
samples = sp.run('bgzip -d -c ' + expressionFile + '|head -n 1',shell=True,stdout=sp.PIPE).stdout.decode('utf-8').strip().split('\t')[4:]

# gene sets
con = sqlite3.connect(dbfile)
query = "SELECT * from term2genes"
dfgs = pd.read_sql_query(query, con)
con.close()
gene_sets = [ row['id'] for _, row in dfgs.iterrows()]

# Set random seed for reproducibility
np.random.seed(42)

n_gene_sets = len(gene_sets)
n_samples = len(samples)

# Generate fake NES values: normal distribution, mean=0, std=0.5, clipped to [-2,2]
nes_matrix = np.random.normal(loc=0, scale=0.5, size=(n_gene_sets, n_samples)).astype(np.float32)
nes_matrix = np.clip(nes_matrix, -2, 2)

with h5py.File('./tp/files/hg38/TermdbTest/rnaseq/TermdbTest.ssgsea.h5','w') as f:
	f.create_dataset('matrix',data=nes_matrix,dtype='float32')
	dt = h5py.string_dtype(encoding='utf-8')
	f.create_dataset('item', data=gene_sets, dtype=dt)
	f.create_dataset('samples', data=samples, dtype=dt)


