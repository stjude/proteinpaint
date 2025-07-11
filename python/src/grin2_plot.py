#################################################################
# Functions used to prepare and return the GRIN2 genome-wide lesion plot
#################################################################

# import dependencies
import numpy as np
import pandas as pd
import warnings
import matplotlib
import matplotlib.pyplot as plt
plt.close('all')
matplotlib.use('Agg')
from matplotlib.patches import Rectangle, Patch

###########################################################
# 1) The function assign plotting coordinates necessary for the genome-wide lesion plot.

def compute_gw_coordinates(grin_res, scl=1_000_000):
    """
    Compute genome-wide coordinates for genes and lesions in GRIN results.

    Parameters:
    - grin_res: dict containing GRIN results with keys 'chr.size', 'gene.data', 'gene.hits', 'lsn.data',
                'gene.index', and 'lsn.index'
    - scl: scaling factor for base pairs (default is 1 million)

    Returns:
    - Modified grin_res with added x.start and x.end genome-wide coordinates.
    """

    # Compute cumulative size in megabases and define x.start and x.end for each chromosome
    cum_size = (grin_res['chr.size']['size'] / scl).cumsum()
    n_chr = len(grin_res['chr.size'])

    grin_res['chr.size']['x.start'] = pd.Series([0] + cum_size[:-1].tolist())
    grin_res['chr.size']['x.end'] = cum_size

    # Initialize columns
    for key in ['gene.data', 'gene.hits', 'lsn.data']:
        grin_res[key]['x.start'] = np.nan
        grin_res[key]['x.end'] = np.nan

    # Sort by row index
    grin_res['gene.data'] = grin_res['gene.data'].sort_values(by='gene.row').reset_index(drop=True)
    grin_res['gene.hits'] = grin_res['gene.hits'].sort_values(by='gene.row').reset_index(drop=True)
    grin_res['lsn.data'] = grin_res['lsn.data'].reset_index(drop=True).sort_values(by='lsn.row').reset_index(drop=True)

    # Assign gene coordinates
    for _, row in grin_res['gene.index'].iterrows():
        chr_match = grin_res['chr.size'].loc[grin_res['chr.size']['chrom'] == row['chrom']]
        if chr_match.empty:
            continue
        chr_start = chr_match['x.start'].values[0]
        gene_rows = range(int(row['row.start']) - 1, int(row['row.end']))  # zero-based index

        grin_res['gene.data'].iloc[gene_rows, grin_res['gene.data'].columns.get_loc('x.start')] = (
                chr_start + grin_res['gene.data'].iloc[gene_rows]['loc.start'] / scl
        )
        grin_res['gene.data'].iloc[gene_rows, grin_res['gene.data'].columns.get_loc('x.end')] = (
                chr_start + grin_res['gene.data'].iloc[gene_rows]['loc.end'] / scl
        )
        grin_res['gene.hits'].iloc[gene_rows, grin_res['gene.hits'].columns.get_loc('x.start')] = (
                chr_start + grin_res['gene.hits'].iloc[gene_rows]['loc.start'] / scl
        )
        grin_res['gene.hits'].iloc[gene_rows, grin_res['gene.hits'].columns.get_loc('x.end')] = (
                chr_start + grin_res['gene.hits'].iloc[gene_rows]['loc.end'] / scl
        )

    # Assign lesion coordinates
    for _, row in grin_res['lsn.index'].iterrows():
        chr_match = grin_res['chr.size'].loc[grin_res['chr.size']['chrom'] == row['chrom']]
        if chr_match.empty:
            continue
        chr_start = chr_match['x.start'].values[0]

        # Adjust from 1-based to 0-based indexing if necessary
        lsn_rows = range(int(row['row.start']) - 1, int(row['row.end']))

        # Ensure the index range is within bounds
        if max(lsn_rows, default=-1) >= len(grin_res['lsn.data']):
            continue

        grin_res['lsn.data'].iloc[lsn_rows, grin_res['lsn.data'].columns.get_loc('x.start')] = (
                chr_start + grin_res['lsn.data'].iloc[lsn_rows]['loc.start'].values / scl
        )
        grin_res['lsn.data'].iloc[lsn_rows, grin_res['lsn.data'].columns.get_loc('x.end')] = (
                chr_start + grin_res['lsn.data'].iloc[lsn_rows]['loc.end'].values / scl
        )

    return grin_res

############################################
# 2) Function assigns default colors for each lesion group in the whole set of GRIN plots.

def default_grin_colors(lsn_types):
    """
    Assign default GRIN colors for lesion types.

    Parameters:
    - lsn_types: list or array-like of lesion type strings

    Returns:
    - dict mapping each unique lesion type to a default color
    """


    uniq_types = sorted(set(lsn_types))
    n_types = len(uniq_types)

    default_colors = [
        "olivedrab", "red", "blue",
        "black", "purple",
        "orange", "brown", "gold",
        "cyan", "steelblue"
    ]

    if n_types > len(default_colors):
        raise ValueError("Too many lesion types for default GRIN colors; please assign colors manually.")

    res = {t: default_colors[i] for i, t in enumerate(uniq_types)}
    return res

#################################################
# 3) Function return a genomewide lesion plot for all lesion types affecting different chromosomes.
# The number of subjects and the probbaility that each locus is affected by one or multiple types of lesions are added in the side panels.

def genomewide_lsn_plot(grin_res, ordered=False, pt_order=None, lsn_colors=None, max_log10q=None):

    # Ensure the availability genome-wide coordinates
    if "x.start" not in grin_res["lsn.data"].columns or "x.end" not in grin_res["lsn.data"].columns:
        grin_res = compute_gw_coordinates(grin_res)

    lsn_data = grin_res["lsn.data"].copy()
    chr_size = grin_res["chr.size"]
    gene_hits = grin_res["gene.hits"]

    if not ordered:
        lsn_data["pts.order"] = pd.factorize(lsn_data["ID"])[0] + 1
    else:
        lsn_data = pt_order.merge(lsn_data, on="ID", how="left")

    n = lsn_data["pts.order"].max()
    chr_size = chr_size.iloc[::-1]

    # Ensure consistent string dtype for lesion types
    lsn_data["lsn.type"] = lsn_data["lsn.type"].astype(str)
    lsn_types = sorted(lsn_data["lsn.type"].dropna().unique())

    # Assign colors
    if lsn_colors is None:
        lsn_colors = default_grin_colors(lsn_types)
    else:
        # Ensure user keys are string and match lesion types
        lsn_colors = {str(k): v for k, v in lsn_colors.items()}
    lsn_data["lsn.colors"] = lsn_data["lsn.type"].map(lsn_colors).fillna("gray")

    # Begin plotting
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim([-0.3 * n, 1.3 * n])
    ax.set_ylim([-1.1 * chr_size["x.end"].iloc[0], 0])
    ax.axis("off")

    # Background strips
    bg_colors = ["gainsboro", "lightgray"]
    for i, row in chr_size.iterrows():
        y = -row["x.end"]
        h = row["x.end"] - row["x.start"]
        color = bg_colors[i % 2]

        ax.add_patch(Rectangle((0, y), n, h, facecolor=color, edgecolor=None))
        ax.add_patch(Rectangle((-0.2 * n, y), 0.125 * n, h, facecolor=color, edgecolor=None))
        ax.add_patch(Rectangle((1.075 * n, y), 0.125 * n, h, facecolor=color, edgecolor=None))

    # Draw lesions
    lsn_data["lsn.size"] = lsn_data["x.end"] - lsn_data["x.start"]
    for _, row in lsn_data.sort_values("lsn.size", ascending=False).iterrows():
        ax.add_patch(Rectangle(
            (row["pts.order"] - 1, -row["x.end"]),
            1,
            row["x.end"] - row["x.start"],
            facecolor=row["lsn.colors"],
            edgecolor=row["lsn.colors"]
        ))

    # Chromosome labels in gutter
    for i, row in chr_size.iterrows():
        ymid = -0.5 * (row["x.start"] + row["x.end"])
        ax.text(-0.025 * n, ymid, row["chrom"], fontsize=7, ha="center", va="center")

    # Prepare nsubj and q values
    nsubj_cols = [f"nsubj.{t}" for t in lsn_types]
    qval_cols = [f"q.nsubj.{t}" for t in lsn_types]
    nsubj_mtx = gene_hits[nsubj_cols].values.T.flatten()
    qval_mtx = gene_hits[qval_cols].values.T.flatten()
    qval_mtx[qval_mtx == 0] = 1e-300
    log10q = -np.log10(qval_mtx)

    nsubj_data = pd.DataFrame({
        "gene": np.tile(gene_hits["gene"].values, len(lsn_types)),
        "x.start": np.tile(gene_hits["x.start"].values, len(lsn_types)),
        "x.end": np.tile(gene_hits["x.end"].values, len(lsn_types)),
        "nsubj": nsubj_mtx,
        "log10q": log10q,
        "lsn.type": np.repeat(lsn_types, len(gene_hits))
    }).query("nsubj > 0").copy()

    nsubj_data["lsn.colors"] = nsubj_data["lsn.type"].map(lsn_colors).fillna("gray")

    # Right panel: n subjects
    for _, row in nsubj_data.sort_values("nsubj", ascending=False).iterrows():
        y = -0.5 * (row["x.start"] + row["x.end"])
        x1 = 1.075 * n
        x2 = x1 + 0.125 * row["nsubj"] / nsubj_data["nsubj"].max() * n
        ax.plot([x1, x2], [y, y], color=row["lsn.colors"], lw=1)

    # Left panel: -log10(q)
    if max_log10q is not None:
        nsubj_data["log10q"] = np.minimum(nsubj_data["log10q"], max_log10q)
    log10q_max = nsubj_data["log10q"].max()

    for _, row in nsubj_data.sort_values("log10q", ascending=False).iterrows():
        y = -0.5 * (row["x.start"] + row["x.end"])
        x1 = -0.075 * n
        x2 = x1 - 0.125 * row["log10q"] / log10q_max * n
        ax.plot([x1, x2], [y, y], color=row["lsn.colors"], lw=1)

    # Top labels for panels
    ax.text(-0.1375 * n, 0.02 * chr_size["x.end"].iloc[0], "-log10(q)", fontsize=10, ha='center', va='bottom')
    ax.text(1.1375 * n, 0.02 * chr_size["x.end"].iloc[0], "Subjects", fontsize=10, ha='center', va='bottom')

    # Axis ticks at bottom
    y_base = -chr_size["x.end"].iloc[0]
    ax.text(-0.075 * n, y_base, "0", fontsize=8, ha='center', va='top')
    ax.text(-0.2 * n, y_base, f"{log10q_max:.1f}", fontsize=8, ha='center', va='top')
    ax.text(1.075 * n, y_base, "0", fontsize=8, ha='center', va='top')
    ax.text(1.2 * n, y_base, str(int(nsubj_data["nsubj"].max())), fontsize=8, ha='center', va='top')

    # Legend below the middle lesion panel
    observed_types = sorted(nsubj_data["lsn.type"].unique())
    legend_handles = [Patch(facecolor=lsn_colors[t], edgecolor="none", label=t)
                      for t in observed_types if t in lsn_colors]

    ax.legend(
        handles=legend_handles,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.02),
        ncol=len(legend_handles),
        frameon=False,
        fontsize=9
    )

    plt.tight_layout()


###################################################################################
# 4)

def genomewide_log10q_plot(grin_res, lsn_colors=None, max_log10q=None):
    # Ensure genome-wide coordinates are present
    if "x.start" not in grin_res["lsn.data"].columns:
        grin_res = compute_gw_coordinates(grin_res)

    lsn_data = grin_res["lsn.data"].copy()

    # Ensure consistent string dtype for lesion types
    lsn_data["lsn.type"] = lsn_data["lsn.type"].astype(str)
    lsn_types = sorted(lsn_data["lsn.type"].dropna().unique())

    # Convert subject IDs to numeric and determine number of unique IDs
    lsn_data["x.ID"] = pd.factorize(lsn_data["ID"])[0] + 1
    n = lsn_data["x.ID"].max()
    n_chr = grin_res["chr.size"].shape[0]

    # Set up plotting area
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(-0.05 * n, 1.2 * n)
    ax.set_ylim(-1.1 * grin_res["chr.size"]["x.end"].iloc[n_chr - 1], 0)
    ax.axis('off')

    # Draw chromosome background bands
    for i in range(n_chr):
        col = "lightgray" if i % 2 == 0 else "gray"
        ax.add_patch(Rectangle(
            (0 * n, -grin_res["chr.size"]["x.start"].iloc[i]),
            width=n,
            height=-(grin_res["chr.size"]["x.end"].iloc[i] - grin_res["chr.size"]["x.start"].iloc[i]),
            facecolor=col,
            edgecolor=None
        ))

    # Extract gene.hits columns matching each lesion type
    selected_cols = []
    for lsn_type in lsn_types:
        matches = grin_res["gene.hits"].filter(regex=rf"\b{lsn_type}\b")
        selected_cols.append(matches)
    final_data = pd.concat(selected_cols, axis=1)

    # Assign default colors if needed
    if lsn_colors is None:
        lsn_colors = default_grin_colors(lsn_types)

    lsn_data["lsn.colors"] = lsn_data["lsn.type"].map(lsn_colors)

    # Sort lesions by size
    lsn_data["lsn.size"] = lsn_data["x.end"] - lsn_data["x.start"]
    lsn_data = lsn_data.sort_values("lsn.size", ascending=False)

    # Extract subject counts and q-values
    nsubj_cols = [f"nsubj.{lt}" for lt in lsn_types]
    qval_cols = [f"q.nsubj.{lt}" for lt in lsn_types]

    gene_hits = grin_res["gene.hits"]
    nsubj_data_rows = []

    for lsn_type in lsn_types:
        if f"nsubj.{lsn_type}" in gene_hits.columns and f"q.nsubj.{lsn_type}" in gene_hits.columns:
            nsubj = gene_hits[f"nsubj.{lsn_type}"].to_numpy()
            qvals = np.clip(gene_hits[f"q.nsubj.{lsn_type}"].to_numpy(), 1e-300, None)
            log10q = -np.log10(qvals)

            df = pd.DataFrame({
                "gene": gene_hits["gene"],
                "x.start": gene_hits["x.start"],
                "x.end": gene_hits["x.end"],
                "nsubj": nsubj,
                "log10q": log10q,
                "lsn.type": lsn_type
            })

            nsubj_data_rows.append(df)

    # Combine all lesion types
    nsubj_data = pd.concat(nsubj_data_rows, ignore_index=True)
    nsubj_data = nsubj_data[nsubj_data["nsubj"] > 0]
    nsubj_data["lsn.colors"] = nsubj_data["lsn.type"].map(lsn_colors)

    nsubj_data.sort_values("nsubj", ascending=False, inplace=True)
    if max_log10q is not None:
        nsubj_data["log10q"] = np.minimum(nsubj_data["log10q"], max_log10q)
    nsubj_data.sort_values("log10q", ascending=False, inplace=True)

    # Draw -log10(q) bars
    for _, row in nsubj_data.iterrows():
        y = -(row["x.start"] + row["x.end"]) / 2
        x1 = 0
        x2 = row["log10q"] / nsubj_data["log10q"].max() * n
        ax.plot([x1, x2], [y, y], color=row["lsn.colors"])

    # Add chromosome labels in white space beside the grey bars
    chroms = grin_res["chr.size"]["chrom"]
    x_offset = 0.02 * n

    for i in range(n_chr):
        y_pos = -(grin_res["chr.size"]["x.start"].iloc[i] + grin_res["chr.size"]["x.end"].iloc[i]) / 2
        if i % 2 == 0:
            xpos = n + x_offset
            halign = "left"
        else:
            xpos = 0 - x_offset
            halign = "right"
        ax.text(xpos, y_pos, chroms.iloc[i], ha=halign, va="center", fontsize=10)

    # Add legend
    ax.legend(
        handles=[Rectangle((0, 0), 1, 1, color=col) for col in lsn_colors.values()],
        labels=lsn_colors.keys(),
        loc="lower center",
        bbox_to_anchor=(0.5, -0.02),
        ncol=len(lsn_colors),
        frameon=False,
        fontsize=11
    )

    # Add axis annotation
    ax.text(n / 2, 0, "-log10(q)", fontsize=12, ha="center", va="bottom")

    tick_xs = np.array([0, 0.25, 0.5, 0.75, 1]) * n
    tick_vals = np.round(np.array([0, max_log10q / 4, max_log10q / 2, max_log10q / 1.3333333333, max_log10q]), 1)
    for tx, tv in zip(tick_xs, tick_vals):
        ax.text(tx, -grin_res["chr.size"]["x.end"].iloc[n_chr - 1], str(tv), ha="center", va="top", fontsize=10)

    plt.tight_layout()
