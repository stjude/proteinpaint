#################################################################
# grin2 core functions (run the analysis and return grin results)
#################################################################

# import dependencies
import pandas as pd
import numpy as np
from datetime import datetime
from scipy.stats import beta
from scipy.stats import rankdata
import numba
from numba import prange
from numba import njit, prange
from statsmodels.stats.multitest import fdrcorrection
from concurrent.futures import ProcessPoolExecutor, as_completed
import xlsxwriter

###############################################################
# 1) This function orders and indexes gene annotation data by chromosome, gene start, and gene end positions.

def order_index_gene_data(gene_data):
    g = len(gene_data)

    # Sort gene_data by chrom, loc.start, loc.end
    gene_data_sorted = gene_data.sort_values(by=["chrom", "loc.start", "loc.end"]).reset_index(drop=True)

    # Find indices where chromosome changes
    chrom_diff = gene_data_sorted["chrom"].ne(gene_data_sorted["chrom"].shift())
    new_chrom = chrom_diff[1:].to_numpy().nonzero()[0]  # ignore first True (first row)

    chr_start = [0] + (new_chrom + 1).tolist()
    chr_end = new_chrom.tolist() + [g - 1]

    # Create gene index table
    gene_index = pd.DataFrame({
        "chrom": gene_data_sorted.loc[chr_start, "chrom"].values,
        "row.start": [i + 1 for i in chr_start],  # 1-based like R
        "row.end": [i + 1 for i in chr_end]
    })

    # Add gene.row index to gene_data
    gene_data_sorted["gene.row"] = range(1, g + 1)  # 1-based

    return {
        "gene.data": gene_data_sorted,
        "gene.index": gene_index
    }

########################################################################
# 2) This function orders and indexes lesion data by lesion type, chromosome, and subject ID.

def order_index_lsn_data(lsn_data):
    l = len(lsn_data)

    # Sort by lsn.type, chrom, ID
    lsn_data_sorted = lsn_data.sort_values(by=["lsn.type", "chrom", "ID"]).reset_index(drop=True)

    # Find changes in lsn.type, chrom, or ID
    diff = (
        lsn_data_sorted["lsn.type"].ne(lsn_data_sorted["lsn.type"].shift()) |
        lsn_data_sorted["chrom"].ne(lsn_data_sorted["chrom"].shift()) |
        lsn_data_sorted["ID"].ne(lsn_data_sorted["ID"].shift())
    )
    lsn_chng = diff[1:].to_numpy().nonzero()[0]

    lsn_start = [0] + (lsn_chng + 1).tolist()
    lsn_end = lsn_chng.tolist() + [l - 1]

    # Create lesion index table
    lsn_index = pd.DataFrame({
        "lsn.type": lsn_data_sorted.loc[lsn_start, "lsn.type"].values,
        "chrom": lsn_data_sorted.loc[lsn_start, "chrom"].values,
        "ID": lsn_data_sorted.loc[lsn_start, "ID"].values,
        "row.start": [i + 1 for i in lsn_start],  # 1-based
        "row.end": [i + 1 for i in lsn_end]
    })

    # Add lsn.row (1-based)
    lsn_data_sorted["lsn.row"] = range(1, l + 1)

    return {
        "lsn.data": lsn_data_sorted,
        "lsn.index": lsn_index
    }

###################################################################################
# 3) Prepares and indexes gene and lesion data for downstream GRIN analysis.

def prep_gene_lsn_data(lsn_data, gene_data, mess_freq=10):

    lsn_dset = order_index_lsn_data(lsn_data)
    lsn_data = lsn_dset['lsn.data']
    lsn_index = lsn_dset['lsn.index']

    gene_dset = order_index_gene_data(gene_data)
    gene_data = gene_dset['gene.data']
    gene_index = gene_dset['gene.index']

    g = len(gene_data)
    l = len(lsn_data)

    gene_pos_data = pd.concat([
        pd.DataFrame({
            'ID': '',
            'lsn.type': '',
            'lsn.row': pd.NA,
            'gene': gene_data['gene'],
            'gene.row': gene_data['gene.row'],
            'chrom': gene_data['chrom'],
            'pos': gene_data['loc.start'],
            'cty': 1
        }),
        pd.DataFrame({
            'ID': '',
            'lsn.type': '',
            'lsn.row': pd.NA,
            'gene': gene_data['gene'],
            'gene.row': gene_data['gene.row'],
            'chrom': gene_data['chrom'],
            'pos': gene_data['loc.end'],
            'cty': 4
        })
    ])
    gene_pos_data.sort_values(by=['chrom', 'pos', 'cty'], inplace=True, ignore_index=True)

    lsn_pos_data = pd.concat([
        pd.DataFrame({
            'ID': lsn_data['ID'],
            'lsn.type': lsn_data['lsn.type'],
            'lsn.row': lsn_data['lsn.row'],
            'gene': '',
            'gene.row': pd.NA,
            'chrom': lsn_data['chrom'],
            'pos': lsn_data['loc.start'],
            'cty': 2
        }),
        pd.DataFrame({
            'ID': lsn_data['ID'],
            'lsn.type': lsn_data['lsn.type'],
            'lsn.row': lsn_data['lsn.row'],
            'gene': '',
            'gene.row': pd.NA,
            'chrom': lsn_data['chrom'],
            'pos': lsn_data['loc.end'],
            'cty': 3
        })
    ])
    lsn_pos_data.sort_values(by=['chrom', 'pos', 'cty'], inplace=True, ignore_index=True)

    gene_lsn_data = pd.concat([gene_pos_data, lsn_pos_data], ignore_index=True)
    gene_lsn_data.sort_values(by=['chrom', 'pos', 'cty'], inplace=True, ignore_index=True)
    gene_lsn_data['glp.row'] = gene_lsn_data.index + 1  # 1-based like in R

    # Create index order by lsn.row and gene.row
    ord_idx = gene_lsn_data.sort_values(by=['lsn.row', 'gene.row', 'cty']).index

    lsn_pos = gene_lsn_data.loc[ord_idx[:2 * l]].reset_index(drop=True)
    lsn_data['glp.row.start'] = lsn_pos.iloc[::2]['glp.row'].values
    lsn_data['glp.row.end'] = lsn_pos.iloc[1::2]['glp.row'].values

    gene_pos = gene_lsn_data.loc[ord_idx[2 * l:]].reset_index(drop=True)
    gene_data['glp.row.start'] = gene_pos.iloc[::2]['glp.row'].values
    gene_data['glp.row.end'] = gene_pos.iloc[1::2]['glp.row'].values


    def check_equality(df1, df2, cols):
        # Ensure column order matches, but don't rely on column names being identical
        return df1.reset_index(drop=True).to_numpy().tolist() == df2.reset_index(drop=True).to_numpy().tolist()

    # Gene start and end validation
    ok_glp_gene_start = check_equality(
        gene_lsn_data.loc[gene_data['glp.row.start'] - 1, ['gene', 'chrom', 'pos']],
        gene_data[['gene', 'chrom', 'loc.start']],
        ['gene', 'chrom', 'loc.start']
    )

    ok_glp_gene_end = check_equality(
        gene_lsn_data.loc[gene_data['glp.row.end'] - 1, ['gene', 'chrom', 'pos']],
        gene_data[['gene', 'chrom', 'loc.end']],
        ['gene', 'chrom', 'loc.end']
    )

    # Lesion start and end validation
    ok_glp_lsn_start = check_equality(
        gene_lsn_data.loc[lsn_data['glp.row.start'] - 1, ['ID', 'chrom', 'pos', 'lsn.type']],
        lsn_data[['ID', 'chrom', 'loc.start', 'lsn.type']],
        ['ID', 'chrom', 'loc.start', 'lsn.type']
    )

    ok_glp_lsn_end = check_equality(
        gene_lsn_data.loc[lsn_data['glp.row.end'] - 1, ['ID', 'chrom', 'pos', 'lsn.type']],
        lsn_data[['ID', 'chrom', 'loc.end', 'lsn.type']],
        ['ID', 'chrom', 'loc.end', 'lsn.type']
    )

    # Adjust gene and lesion row numbers by -1 for 0-based Python indexing
    gene_lsn_data['gene.row.0'] = gene_lsn_data['gene.row'] - 1
    gene_lsn_data['lsn.row.0'] = gene_lsn_data['lsn.row'] - 1

    # Cross-validation from gene_lsn_data back to gene and lesion data
    ok_gene_start = check_equality(
        gene_lsn_data[gene_lsn_data['cty'] == 1][['gene', 'chrom', 'pos']].rename(
            columns={"pos": "loc.start"}).reset_index(drop=True),
        gene_data.iloc[gene_lsn_data[gene_lsn_data['cty'] == 1]['gene.row.0'].astype(int).values][
            ['gene', 'chrom', 'loc.start']].reset_index(drop=True),
        ['gene', 'chrom', 'loc.start']
    )

    ok_gene_end = check_equality(
        gene_lsn_data[gene_lsn_data['cty'] == 4][['gene', 'chrom', 'pos']].rename(
            columns={"pos": "loc.end"}).reset_index(drop=True),
        gene_data.iloc[gene_lsn_data[gene_lsn_data['cty'] == 4]['gene.row.0'].astype(int).values][
            ['gene', 'chrom', 'loc.end']].reset_index(drop=True),
        ['gene', 'chrom', 'loc.end']
    )

    ok_lsn_start = check_equality(
        gene_lsn_data[gene_lsn_data['cty'] == 2][['ID', 'chrom', 'pos', 'lsn.type']].rename(
            columns={"pos": "loc.start"}).reset_index(drop=True),
        lsn_data.iloc[gene_lsn_data[gene_lsn_data['cty'] == 2]['lsn.row.0'].astype(int).values][
            ['ID', 'chrom', 'loc.start', 'lsn.type']].reset_index(drop=True),
        ['ID', 'chrom', 'loc.start', 'lsn.type']
    )

    ok_lsn_end = check_equality(
        gene_lsn_data[gene_lsn_data['cty'] == 3][['ID', 'chrom', 'pos', 'lsn.type']].rename(
            columns={"pos": "loc.end"}).reset_index(drop=True),
        lsn_data.iloc[gene_lsn_data[gene_lsn_data['cty'] == 3]['lsn.row.0'].astype(int).values][
            ['ID', 'chrom', 'loc.end', 'lsn.type']].reset_index(drop=True),
        ['ID', 'chrom', 'loc.end', 'lsn.type']
    )

    all_ok = all([
        ok_glp_gene_start, ok_glp_gene_end,
        ok_glp_lsn_start, ok_glp_lsn_end,
        ok_gene_start, ok_gene_end,
        ok_lsn_start, ok_lsn_end
    ])

    if not all_ok:
        raise ValueError("Error in constructing and indexing combined lesion and gene data.")


    return {
        'lsn.data': lsn_data,
        'gene.data': gene_data,
        'gene.lsn.data': gene_lsn_data,
        'gene.index': gene_index,
        'lsn.index': lsn_index
    }


#################################################################
# 4) Identifies overlaps between genes and genomic lesions

def find_gene_lsn_overlaps(gl_data):
    import pandas as pd

    gene_data = gl_data["gene.data"].copy()
    lsn_data = gl_data["lsn.data"].copy()
    gene_lsn_data = gl_data["gene.lsn.data"].copy()
    gene_index = gl_data["gene.index"]
    lsn_index = gl_data["lsn.index"]

    m = len(gene_lsn_data)

    gene_row_mtch = []
    lsn_row_mtch = []
    current_genes = set()
    current_lsns = set()

    for i in range(m):
        row = gene_lsn_data.iloc[i]
        cty = row["cty"]
        gene_row = row.get("gene.row")
        lsn_row = row.get("lsn.row")

        if cty == 1:  # enter gene
            current_genes.add(gene_row)
            for l in current_lsns:
                gene_row_mtch.append(gene_row)
                lsn_row_mtch.append(l)

        elif cty == 4:  # exit gene
            current_genes.discard(gene_row)

        elif cty == 2:  # enter lesion
            for g in current_genes:
                gene_row_mtch.append(g)
                lsn_row_mtch.append(lsn_row)
            current_lsns.add(lsn_row)

        elif cty == 3:  # exit lesion
            current_lsns.discard(lsn_row)


    # Final join and formatting
    gene_cols = ["gene.row", "gene", "chrom", "loc.start", "loc.end"]
    lsn_cols = ["lsn.row", "ID", "chrom", "loc.start", "loc.end", "lsn.type"]

    # Create iloc position maps to safely access rows
    gene_row_to_iloc = {row["gene.row"]: i for i, row in gene_data.reset_index().iterrows()}
    lsn_row_to_iloc = {row["lsn.row"]: i for i, row in lsn_data.reset_index().iterrows()}

    gene_ilocs = [gene_row_to_iloc[r] for r in gene_row_mtch]
    lsn_ilocs = [lsn_row_to_iloc[r] for r in lsn_row_mtch]

    gene_hit_data = gene_data.iloc[gene_ilocs][gene_cols].reset_index(drop=True)
    lsn_hit_data = lsn_data.iloc[lsn_ilocs][lsn_cols].reset_index(drop=True)

    gene_lsn_hits = pd.concat([gene_hit_data, lsn_hit_data], axis=1)
    gene_lsn_hits.columns = [
        "gene.row", "gene", "gene.chrom", "gene.loc.start", "gene.loc.end",
        "lsn.row", "ID", "lsn.chrom", "lsn.loc.start", "lsn.loc.end", "lsn.type"
    ]

    return {
        "lsn.data": lsn_data,
        "gene.data": gene_data,
        "gene.lsn.data": gene_lsn_data,
        "gene.lsn.hits": gene_lsn_hits,
        "gene.index": gene_index,
        "lsn.index": lsn_index,
    }

    return result

############################################################
# 5) Computes the number of genomic lesions ("hits") affecting each gene by lesion category.

def count_hits(ov_data):

    lsn_data = ov_data["lsn.data"]
    lsn_index = ov_data["lsn.index"]
    gene_lsn_hits = ov_data["gene.lsn.hits"]
    gene_lsn_data = ov_data["gene.lsn.data"]
    gene_data = ov_data["gene.data"]
    gene_index = ov_data["gene.index"]

    # Rebuild a mapping from gene name to row index
    gene_row_map = pd.Series(gene_data.index.values, index=gene_data["gene"]).to_dict()

    # Ensure gene.row in gene_lsn_hits is properly mapped to index
    if gene_lsn_hits["gene.row"].max() > len(gene_data):
        raise ValueError("gene.row values exceed number of rows in gene_data.")

    # Defensive: reassign gene.row to match current gene_data index
    gene_name_to_index = gene_data.set_index("gene").index
    gene_lsn_hits["gene.row"] = gene_lsn_hits["gene"].map(gene_row_map)

    g = len(gene_data)
    lsn_types = sorted(lsn_index["lsn.type"].unique())
    k = len(lsn_types)

    nhit_mtx = pd.DataFrame(0, index=range(g), columns=lsn_types)

    nhit_tbl = pd.crosstab(gene_lsn_hits["gene.row"], gene_lsn_hits["lsn.type"])
    for gene_row, row_data in nhit_tbl.iterrows():
        if gene_row in nhit_mtx.index:
            nhit_mtx.loc[gene_row, row_data.index] = row_data.values

    # Deduplicate by gene, subject, and lesion type
    gene_subj_type = (
        gene_lsn_hits["gene.row"].astype(str) + "_" +
        gene_lsn_hits["ID"].astype(str) + "_" +
        gene_lsn_hits["lsn.type"].astype(str)
    )
    dup_mask = gene_subj_type.duplicated()
    subj_gene_hits = gene_lsn_hits[~dup_mask]

    nsubj_mtx = pd.DataFrame(0, index=range(g), columns=lsn_types)

    nsubj_tbl = pd.crosstab(subj_gene_hits["gene.row"], subj_gene_hits["lsn.type"])
    for gene_row, row_data in nsubj_tbl.iterrows():
        if gene_row in nsubj_mtx.index:
            nsubj_mtx.loc[gene_row, row_data.index] = row_data.values

    return {
        "lsn.data": lsn_data,
        "lsn.index": lsn_index,
        "gene.data": gene_data,
        "gene.index": gene_index,
        "nhit.mtx": nhit_mtx,
        "nsubj.mtx": nsubj_mtx,
        "gene.lsn.data": gene_lsn_hits,
        "glp.data": gene_lsn_data,
    }

###################################################################
# Numba-optimized convolution (prob_hits helper functions)
######################################################
# 6) Compute a convolution of Bernoullis for each row of a Bernoulli success probability matrix (part of the prob.hits function)

@numba.njit(parallel=True, fastmath=True)
def row_bern_conv(P, max_x):
    m, n = P.shape
    Pr = np.zeros((m, max_x + 2))
    for i in range(m):
        Pr[i, 0] = 1.0  # initialize P(X=0)=1

    for j in range(n):
        p_col = P[:, j]
        for i in numba.prange(m):
            p = p_col[i]
            for k in range(max_x, -1, -1):
                Pr[i, k + 1] += Pr[i, k] * p
                Pr[i, k] *= (1.0 - p)

    return Pr

######################################################################################################
# 7) Compute the probability that a subject has a hit for each gene (part of the prob.hits function).

def row_prob_subj_hit(P, IDs):
    IDs = np.asarray(IDs)
    order = np.argsort(IDs)
    P_sorted = P[:, order]
    IDs_sorted = IDs[order]

    # Compute subject change points
    changes = np.where(IDs_sorted[1:] != IDs_sorted[:-1])[0]
    ID_start = np.concatenate(([0], changes + 1))
    ID_end = np.concatenate((changes, [len(IDs_sorted) - 1]))

    g = P.shape[0]
    n = len(ID_start)
    Pr = np.zeros((g, n))

    for i in range(n):
        pr_block = P_sorted[:, ID_start[i]:ID_end[i] + 1]
        np.clip(pr_block, 1e-10, 1 - 1e-10, out=pr_block)
        Pr[:, i] = 1 - np.exp(np.sum(np.log(1 - pr_block), axis=1))

    return Pr

######################################################
# 8) compute ordered p-values for the constellation test results

def p_order(P):
    P = np.array(P)
    sorted_P = np.sort(P, axis=1)
    k = P.shape[1]
    res = np.empty_like(sorted_P)
    for i in range(k):
        res[:, i] = beta.cdf(sorted_P[:, i], i + 1, k - i + 1)
    return res


############################################################
# 9) This function builds pr_gene_hit matrix (Hit probability per gene-lesion pair) computed as
# gene.size+lsn.size/chromosome size in small pieces that's equal to the chunk size (used for n.hits stats; saves a lot of memory)
# The other huge data matrix is pr_subj derived from pr_gene_hit for the probability that a gene is hit in this many subjects or more (used for n.subj stats)

def process_block_in_chunks(gene_size, lsn_size, lsn_subj_IDs, chrom_size, chunk_size=5000):
    """
    Chunk-based pr_gene_hit and pr_subj computation to reduce memory use.
    """
    G = len(gene_size)
    L = len(lsn_size)

    # Create log(1 - pr_gene_hit) sum buffer per gene-subject pair
    subj_ids_unique, subj_inv = np.unique(lsn_subj_IDs, return_inverse=True)
    N_subj = len(subj_ids_unique)
    logsum = np.zeros((G, N_subj), dtype=np.float64)

    for start in range(0, L, chunk_size):
        end = min(start + chunk_size, L)
        lsn_chunk_size = lsn_size[start:end]
        lsn_chunk_ids = lsn_subj_IDs[start:end]
        subj_chunk_inv = subj_inv[start:end]

        # Compute chunked pr_gene_hit
        pr_chunk = np.outer(gene_size, np.ones(end - start)) + np.outer(np.ones(G), lsn_chunk_size)
        pr_chunk /= chrom_size
        np.clip(pr_chunk, 1e-10, 1 - 1e-10, out=pr_chunk)

        # log(1 - pr)
        log_chunk = np.log(1.0 - pr_chunk)

        # Accumulate by subject
        for j in range(end - start):
            subj_idx = subj_chunk_inv[j]
            logsum[:, subj_idx] += log_chunk[:, j]

    # Final pr_subj = 1 - exp(sum(log(1 - pr))) = 1 - prod(1 - pr)
    pr_subj = 1.0 - np.exp(logsum)

    # Final pr_gene_hit
    pr_gene_hit = None  # Optional: set to None if not needed downstream
    return pr_gene_hit, pr_subj


###############################################################
# 10) Main function that computes the probability that each genomic locus is affected by one or more types of genomic lesions.

def prob_hits(hit_cnt, chr_size):
    lsn_data = hit_cnt["lsn.data"]
    gene_data = hit_cnt["gene.data"]
    gene_lsn_data = hit_cnt["gene.lsn.data"]
    gene_index = hit_cnt["gene.index"]
    lsn_index = hit_cnt["lsn.index"]
    nhit_mtx = hit_cnt["nhit.mtx"]
    nsubj_mtx = hit_cnt["nsubj.mtx"]

    # Ensure 'lsn.row' is the index for safe .loc access
    if "lsn.row" in lsn_data.columns:
        lsn_data = lsn_data.set_index("lsn.row", drop=False)

    num_lsn = lsn_data["lsn.type"].unique()

    gene_lsn_data = gene_lsn_data.sort_values(by=["lsn.type", "lsn.chrom", "gene.row", "ID"]).reset_index(drop=True)
    m = gene_lsn_data.shape[0]
    new_sect = np.where(
        (gene_lsn_data["gene.chrom"].values[1:] != gene_lsn_data["gene.chrom"].values[:-1]) |
        (gene_lsn_data["lsn.type"].values[1:] != gene_lsn_data["lsn.type"].values[:-1]) |
        (gene_lsn_data["gene.row"].values[1:] != gene_lsn_data["gene.row"].values[:-1])
    )[0]

    sect_start = [0] + (new_sect + 1).tolist()
    sect_end = new_sect.tolist() + [m - 1]

    gene_lsn_index = pd.DataFrame({
        "lsn.type": gene_lsn_data.iloc[sect_start]["lsn.type"].values,
        "chrom": gene_lsn_data.loc[sect_start, "gene.chrom"].values,
        "gene.row": gene_lsn_data.loc[sect_start, "gene.row"].values,
        "row.start": sect_start,
        "row.end": sect_end,
    })
    gene_lsn_index["n.lsns"] = gene_lsn_index["row.end"] - gene_lsn_index["row.start"] + 1

    k = gene_lsn_index.shape[0]
    new_chr = gene_lsn_index["chrom"].shift(-1) != gene_lsn_index["chrom"]
    new_chr = new_chr[:k - 1][new_chr[:k - 1]].index
    chr_start = [0] + list(new_chr + 1)
    chr_end = list(new_chr) + [k - 1]

    gene_lsn_chr_index = pd.DataFrame({
        "lsn.type": gene_lsn_index.loc[chr_start, "lsn.type"].values,
        "chrom": gene_lsn_index.loc[chr_start, "chrom"].values,
        "row.start": chr_start,
        "row.end": chr_end,
    })
    gene_lsn_chr_index["n.rows"] = gene_lsn_chr_index["row.end"] - gene_lsn_chr_index["row.start"] + 1

    nr_li = lsn_index.shape[0]
    cond = (
            (lsn_index["lsn.type"].shift(-1) != lsn_index["lsn.type"]) |
            (lsn_index["chrom"].shift(-1) != lsn_index["chrom"])
    )
    new_chr = cond[:nr_li - 1][cond[:nr_li - 1]].index
    chr_start = [0] + list(new_chr + 1)
    chr_end = list(new_chr) + [nr_li - 1]

    lsn_chr_index = pd.DataFrame({
        "lsn.type": lsn_index.loc[chr_start, "lsn.type"].values,
        "chrom": lsn_index.loc[chr_start, "chrom"].values,
        "row.start": chr_start,
        "row.end": chr_end,
    })

    b = gene_lsn_chr_index.shape[0]
    g, nlt = nhit_mtx.shape

    # Init p-value matrices
    p_nsubj = pd.DataFrame(np.ones((g, nlt)), columns=nsubj_mtx.columns)
    p_nhit = pd.DataFrame(np.nan, index=range(g), columns=nhit_mtx.columns)

    for i in range(b):
        gli_start = gene_lsn_chr_index.loc[i, "row.start"]
        gli_end = gene_lsn_chr_index.loc[i, "row.end"]
        gld_start = gene_lsn_index.loc[gli_start, "row.start"]
        gld_end = gene_lsn_index.loc[gli_end, "row.end"]
        gld_rows = list(range(gld_start, gld_end + 1))
        gene_rows = gene_lsn_data.loc[gld_rows, "gene.row"].unique()
        n_genes = len(gene_rows)

        lsn_chr_match = lsn_chr_index[
            (lsn_chr_index["lsn.type"] == gene_lsn_chr_index.loc[i, "lsn.type"]) &
            (lsn_chr_index["chrom"] == gene_lsn_chr_index.loc[i, "chrom"])
            ]
        if lsn_chr_match.empty:
            continue

        lsn_index_start = lsn_chr_match["row.start"].values[0]
        lsn_index_end = lsn_chr_match["row.end"].values[0]
        lsn_start = lsn_index.loc[lsn_index_start, "row.start"]
        lsn_end = lsn_index.loc[lsn_index_end, "row.end"]
        lsn_rows = list(range(lsn_start, lsn_end + 1))

        # index is the 'lsn.row'
        lsn_type = lsn_data.loc[lsn_start, "lsn.type"]

        chrom = gene_lsn_chr_index.loc[i, "chrom"]
        chrom_size = chr_size.loc[chr_size["chrom"] == chrom, "size"].values[0]


        gene_pos = gene_data.index.get_indexer(gene_rows)
        if np.any(gene_pos < 0):
            continue
        lsn_pos = lsn_data.index.get_indexer(lsn_rows)
        if np.any(lsn_pos < 0):
            continue

        gene_size = (gene_data.iloc[gene_pos]["loc.end"].values - gene_data.iloc[gene_pos]["loc.start"].values + 1).astype(np.float64)
        lsn_size = (lsn_data.iloc[lsn_pos]["loc.end"].values - lsn_data.iloc[lsn_pos]["loc.start"].values + 1).astype(np.float64)
        lsn_subj_IDs = lsn_data.loc[lsn_rows, "ID"].values

        # Use process_block_in_chunks for pr_subj only
        _, pr_subj = process_block_in_chunks(gene_size, lsn_size, lsn_subj_IDs, chrom_size, chunk_size=5000)

        max_nsubj = int(nsubj_mtx.loc[gene_rows, lsn_type].max())
        pr_nsubj = row_bern_conv(pr_subj, max_nsubj)

        gene_idx = gene_data.index.get_indexer(gene_rows)
        nsubj_vals = nsubj_mtx.loc[gene_rows, lsn_type].values.astype(int)

        p_nsubj_values = np.empty(n_genes, dtype=np.float64)
        for j in range(n_genes):
            p_nsubj_values[j] = pr_nsubj[j, nsubj_vals[j]:].sum()

        p_nsubj.loc[gene_rows, lsn_type] = p_nsubj_values


    q_nsubj = p_nsubj.copy()
    for i in p_nsubj.columns:
        pi_hat = min(1, 2 * p_nsubj[i].mean(skipna=True))
        q_nsubj[i] = pi_hat * fdrcorrection(p_nsubj[i].fillna(1))[1]

    # Set desired precision (significant digits)
    round_digits = 4

    # Safe significant-digit rounding function
    def sig_round(x):
        try:
            if x == 0 or not np.isfinite(x):
                return 0.0
            with np.errstate(divide='ignore', invalid='ignore'):
                return np.round(x, round_digits - int(np.floor(np.log10(abs(x)))) - 1)
        except Exception:
            return 0.0

    if len(num_lsn) > 1:
        p_ord_nsubj = pd.DataFrame(p_order(p_nsubj), columns=p_nsubj.columns)
        q_ord_nsubj = p_ord_nsubj.copy()
        for i in p_ord_nsubj.columns:
            pi_hat = min(1, 2 * p_ord_nsubj[i].mean(skipna=True))
            q_ord_nsubj[i] = pi_hat * fdrcorrection(p_ord_nsubj[i].fillna(1))[1]

        # Rename columns
        p_ord_nsubj.columns = [f"p{i + 1}.nsubj" for i in range(p_nsubj.shape[1])]
        q_ord_nsubj.columns = [f"q{i + 1}.nsubj" for i in range(p_nsubj.shape[1])]

        # Apply robust significant-digit rounding
        p_nsubj = p_nsubj.apply(lambda col: col.map(sig_round))
        q_nsubj = q_nsubj.apply(lambda col: col.map(sig_round))
        p_ord_nsubj = p_ord_nsubj.apply(lambda col: col.map(sig_round))
        q_ord_nsubj = q_ord_nsubj.apply(lambda col: col.map(sig_round))

        gene_res = pd.concat([
            gene_data.drop(columns=["glp.row.start", "glp.row.end"], errors="ignore"),
            nsubj_mtx.add_prefix("nsubj."),
            p_nsubj.add_prefix("p.nsubj."),
            q_nsubj.add_prefix("q.nsubj."),
            p_ord_nsubj,
            q_ord_nsubj
        ], axis=1)

    else:
        # Apply robust rounding for single lesion type
        p_nsubj = p_nsubj.apply(lambda col: col.map(sig_round))
        q_nsubj = q_nsubj.apply(lambda col: col.map(sig_round))

        gene_res = pd.concat([
            gene_data.drop(columns=["glp.row.start", "glp.row.end"], errors="ignore"),
            nsubj_mtx.add_prefix("nsubj."),
            p_nsubj.add_prefix("p.nsubj."),
            q_nsubj.add_prefix("q.nsubj.")
        ], axis=1)

    return {
        "gene.hits": gene_res,
        "lsn.data": lsn_data,
        "gene.data": gene_data,
        "gene.lsn.data": gene_lsn_data,
        "chr.size": chr_size,
        "gene.index": gene_index,
        "lsn.index": lsn_index
    }

######################################################################
# 11) This function executes the GRIN statistical framework

def grin_stats(lsn_data, gene_data, chr_size):
    """
    Run full GRIN statistical analysis pipeline:
    - Prepare data
    - Find gene-lesion overlaps
    - Count hits and affected subjects
    - Compute statistical significance (p/q values)

    Parameters:
    - lsn_data: DataFrame of lesion data
    - gene_data: DataFrame of gene data
    - chr_size: Dictionary mapping chromosome to chromosome size

    Returns:
    - DataFrame with gene stats, including p-values and q-values
    """

    prep_data = prep_gene_lsn_data(lsn_data, gene_data)

    overlaps = find_gene_lsn_overlaps(prep_data)

    counts_df = count_hits(overlaps)

    result_df = prob_hits(counts_df, chr_size)

    return result_df

############################################
# 12) The function Write GRIN results to an excel file with multiple sheets that include:
# GRIN results, input lesion data, gene annotation data, chromosome size, and methods paragraph.

def write_grin_xlsx(grin_result, output_file):
    # Extract core result components:
    rpt_res = {
        "gene.hits": grin_result["gene.hits"],
        #"gene.lsn.data": grin_result["gene.lsn.data"],
        "lsn.data": grin_result["lsn.data"],
        "gene.data": grin_result["gene.data"],
        "chr.size": grin_result["chr.size"]
    }

    # Description of each sheet
    sheet_int = pd.DataFrame({
        "sheet.name": ["gene.hits", "lsn.data", "gene.data", "chr.size"],
        "col.name": ["entire sheet"] * 4,
        "meaning": [
            "GRIN statistical results",
            "input lesion data",
            "input gene location data",
            "input chromosome size data"
        ]
    })

    # Interpret gene.hits columns
    gh = rpt_res["gene.hits"].copy()
    gh_cols = gh.columns
    genehit_int = pd.DataFrame({
        "sheet.name": ["gene.hits"] * len(gh_cols),
        "col.name": gh_cols,
        "meaning": gh_cols
    })

    default_meanings = {
        "gene.row": "gene data row index",
        "gene": "gene name",
        "loc.start": "locus of left edge of gene",
        "loc.end": "locus of right edge of gene"
    }

    for col, meaning in default_meanings.items():
        genehit_int.loc[genehit_int["col.name"] == col, "meaning"] = meaning

    def update_meaning(col_prefix, label):
        for col in gh_cols:
            if col.startswith(col_prefix):
                subtype = col.split(".", 1)[-1]
                genehit_int.loc[genehit_int["col.name"] == col, "meaning"] = f"{label} {subtype} lesion overlapping the gene locus"

    update_meaning("nsubj", "Number of subjects with a")
    update_meaning("p.nsubj", "p-value for the number of subjects with a")
    update_meaning("q.nsubj", "FDR estimate for the number of subjects with a")

    lsn_types = sorted(grin_result["lsn.data"]["lsn.type"].unique())
    for i, t in enumerate(lsn_types):
        for prefix in ["p", "q"]:
            for suffix in ["nsubj"]:
                col = f"{prefix}{i+1}.{suffix}"
                if suffix == "nsubj":
                    msg = f"{prefix}-value for the number of subjects with any {i+1} type(s) of lesion overlapping the gene locus"

    # Lesion data interpretation
    lsn_cols = rpt_res["lsn.data"].columns
    lsn_int = pd.DataFrame({
        "sheet.name": "lsn.data",
        "col.name": lsn_cols,
        "meaning": lsn_cols
    })
    lsn_map = {
        "ID": "Input Subject Identifier",
        "chrom": "Input Chromosome",
        "loc.start": "Input Lesion Left Edge",
        "loc.end": "Input Lesion Right Edge",
        "lsn.type": "Input Lesion Type"
    }
    for k, v in lsn_map.items():
        lsn_int.loc[lsn_int["col.name"] == k, "meaning"] = v

    # Gene data interpretation
    gene_cols = rpt_res["gene.data"].columns
    gene_int = pd.DataFrame({
        "sheet.name": "gene.data",
        "col.name": gene_cols,
        "meaning": "Echoed from Input"
    })
    gene_map = {
        "gene": "Input Gene Locus Name",
        "chrom": "Input Gene Locus Chromosome",
        "loc.start": "Input Gene Locus Left Edge",
        "loc.end": "Input Gene Locus Right Edge"
    }
    for k, v in gene_map.items():
        gene_int.loc[gene_int["col.name"] == k, "meaning"] = v

    # Chromosome size interpretation
    chr_cols = rpt_res["chr.size"].columns
    chr_int = pd.DataFrame({
        "sheet.name": "chr.size",
        "col.name": chr_cols,
        "meaning": "Echoed from Input"
    })
    chr_map = {
        "chrom": "Input Chromosome",
        "size": "Input Chromosome Size"
    }
    for k, v in chr_map.items():
        chr_int.loc[chr_int["col.name"] == k, "meaning"] = v

    # Combine interpretation
    interpretation = pd.concat([sheet_int, genehit_int, lsn_int, gene_int, chr_int], ignore_index=True)
    rpt_res["interpretation"] = interpretation

    # Methods paragraph
    methods_text = [
        "The genomic random interval model [ref 1] was used to evaluate the statistical significance of the number of subjects with " +
        f"each type of lesion ({','.join(lsn_types)}) in each gene.",
        "For each type of lesion, robust false discovery estimates were computed from p-values using Storey's q-value [ref 2] " +
        "with the Pounds-Cheng estimator of the proportion of hypothesis tests with a true null [ref 3].",
        f"Additionally, p-values for the number of subjects with any 1 to {len(lsn_types)} types of lesions " +
        "were computed using the beta distribution derived for order statistics of the uniform distribution [ref 4].",
        "",
        "REFERENCES",
        "[ref 1] Pounds S, et al (2013) A genomic random interval model for statistical analysis of genomic lesion data. Bioinformatics, 2013 Sep 1;29(17):2088-95 (PMID: 23842812).",
        "[ref 2] Storey J (2002). A direct approach to false discovery rates. Journal of the Royal Statistical Society Series B. 64(3): 479-498. (doi.org/10.1111/1467-9868.00346).",
        "[ref 3] Pounds S and Cheng C (2005) Robust estimation of the false discovery rate. Bioinformatics 22(16): 1979-87. (PMID: 16777905).",
        "[ref 4] Casella G and Berger RL (1990) Statistical Inference. Wadsworth & Brooks/Cole: Pacific Grove, California. Example 5.5.1."
    ]
    rpt_res["methods.paragraph"] = pd.DataFrame({"methods.paragraph": methods_text})

    # Write all sheets to Excel
    with pd.ExcelWriter(output_file, engine="xlsxwriter") as writer:
        for key, df in rpt_res.items():
            df.to_excel(writer, sheet_name=key[:31], index=False)

    return None
