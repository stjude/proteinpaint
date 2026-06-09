###################
# grin2PpWrapper  #
###################

"""
Usage: echo <in_json> | python3 grin2PpWrapper.py

Input JSON:
{
 genedb: gene db file path
 chromosomelist={ <key>: <len>, }
 lesion: JSON string containing array of lesion data
 maxGenesToShow: int (default=500)
 lesionTypeMap: dict {lesionType: displayName} - maps GRIN2 lesion types to user-friendly names
}

Output JSON:
{
 topGeneTable: {columns: [...], rows: [...]}
 totalGenes: int
 showingTop: int
 lesionCounts: {byType: dict{type: count}}
 geneHits: [{gene, chrom, loc.start, loc.end, nsubj.<type>, q.nsubj.<type>, ...}, ...]
}
"""

import warnings, json, sys, os, re
import sqlite3
import pandas as pd
import numpy as np
from grin2_core import grin_stats
# from grin2_core import timed_grin_stats

warnings.filterwarnings('ignore')

# Bidirectional-artifact flag threshold. A gene significant for BOTH gain and loss
# (q.nsubj.gain < alpha AND q.nsubj.loss < alpha) is far more consistent with a
# germline CNV / mappability artifact (e.g. OR clusters, FAM90A) than a directional
# somatic driver. Pure post-hoc annotation; see GRIN2 hardening report (Tier 1).
BIDIRECTIONAL_ALPHA = 0.05

# Blacklist / segmental-duplication overlap threshold. A gene is flagged as a
# region artifact when at least this fraction of its span lies within a known
# artifact region (UCSC segmental duplications and/or the ENCODE blacklist v2).
# Fraction-based (not any-overlap) so genuine drivers that merely abut a segdup
# (e.g. KRAS, ~10% covered) are spared, while germline/segdup-embedded gene
# families (FAM90A, POTE, GOLGA8, DUX, DEFB, HLA; ~100% covered) are flagged.
# See GRIN2 hardening report (Tier 1 overlap-annotation / Tier 2 region mask).
BLACKLIST_OVERLAP_FRAC = 0.5

def write_error(msg):
	print(f"ERROR: {msg}", file=sys.stderr)

def load_merged_bed(path):
	"""Load a BED(.gz) of artifact regions and merge overlapping intervals per
	chromosome. Returns {chrom: (starts, ends)} of merged, start-sorted intervals
	as numpy arrays, suitable for fast coverage queries."""
	bed = pd.read_csv(
		path, sep="\t", header=None, usecols=[0, 1, 2],
		names=["chrom", "start", "end"], comment="#"
	)
	idx = {}
	for chrom, sub in bed.groupby("chrom"):
		iv = sub[["start", "end"]].to_numpy()
		iv = iv[np.argsort(iv[:, 0])]
		merged = []
		cs, ce = iv[0]
		for s, e in iv[1:]:
			if s <= ce:
				ce = max(ce, e)
			else:
				merged.append((cs, ce))
				cs, ce = s, e
		merged.append((cs, ce))
		m = np.array(merged)
		idx[chrom] = (m[:, 0], m[:, 1])
	return idx

def covered_fraction(idx, chrom, gstart, gend):
	"""Fraction of the gene span [gstart, gend) covered by merged artifact
	intervals on `chrom`. Uses prefix search over start-sorted merged intervals."""
	glen = gend - gstart
	if glen <= 0 or chrom not in idx:
		return 0.0
	starts, ends = idx[chrom]
	k = np.searchsorted(starts, gend, side="left")  # intervals starting before gene end
	if k == 0:
		return 0.0
	s = starts[:k]
	e = ends[:k]
	mask = e > gstart  # ... that also end after gene start
	if not mask.any():
		return 0.0
	s = np.maximum(s[mask], gstart)
	e = np.minimum(e[mask], gend)
	return float(np.clip(e - s, 0, None).sum()) / glen

def compute_blacklist_flag(data, bed_paths, threshold=BLACKLIST_OVERLAP_FRAC):
	"""Boolean Series (aligned to `data`) flagging genes whose span is at least
	`threshold` covered by any provided artifact BED. Missing/unreadable BEDs are
	skipped; returns None when no usable BED is available so callers can omit the
	column entirely (e.g. genomes without bundled artifact tracks)."""
	indexes = []
	for p in bed_paths or []:
		if p and os.path.exists(p):
			try:
				indexes.append(load_merged_bed(p))
			except Exception as e:
				write_error(f"Could not load artifact BED {p}: {e}")
	if not indexes:
		return None
	chroms = data["chrom"].to_numpy()
	starts = data["loc.start"].to_numpy()
	ends = data["loc.end"].to_numpy()
	flags = np.zeros(len(data), dtype=bool)
	for i in range(len(data)):
		frac = max(
			(covered_fraction(idx, chroms[i], int(starts[i]), int(ends[i])) for idx in indexes),
			default=0.0
		)
		flags[i] = frac >= threshold
	return pd.Series(flags, index=data.index)

# Artifact-prone gene families (symbol-based). These multi-allelic /
# segmental-duplication-embedded / immune-locus families are routinely flagged
# in cancer CNV-recurrence analyses (report Tier 1 gene-family label). Catches
# the unidirectional OR/HLA/MUC/KRTAP residuals that the bidirectional and
# blacklist/segdup flags miss. Symbol-prefix matched, first match wins; patterns
# are deliberately precise to avoid real drivers (e.g. ORC/ORAI, TRADD/TRAF, IGF).
GENE_FAMILY_PATTERNS = [
	("OR", re.compile(r"^OR\d{1,2}[A-Z]")),   # olfactory receptors (OR4K5, OR52N1, OR2T10)
	("HLA", re.compile(r"^HLA-")),            # MHC class I/II
	("IG", re.compile(r"^IG[HKL][VDJ]")),     # immunoglobulin V/D/J segments
	("TR", re.compile(r"^TR[ABGD][VDJ]\d")),  # T-cell receptor V/D/J segments
	("MUC", re.compile(r"^MUC\d")),           # mucins
	("DEF", re.compile(r"^DEF[AB]\d")),       # defensins
	("KRTAP", re.compile(r"^KRTAP")),         # keratin-associated proteins
	("ZNF", re.compile(r"^ZNF\d")),           # zinc-finger clusters
]

def classify_gene_family(symbol):
	"""Return the artifact-prone gene-family acronym for a gene symbol, or None."""
	if not isinstance(symbol, str):
		return None
	for name, pat in GENE_FAMILY_PATTERNS:
		if pat.match(symbol):
			return name
	return None

def get_sig_values(data):
	"""Find existing p/q/n columns for all data types by discovering them from column names"""
	p_prefix = "p.nsubj."
	# Discover lesion types from actual column names
	existing_p_cols = [col for col in data.columns if col.startswith(p_prefix)]
	existing_q_cols = [col.replace("p.nsubj.", "q.nsubj.") for col in existing_p_cols]
	existing_n_cols = [col.replace("p.nsubj.", "nsubj.") for col in existing_p_cols]
	return {
		"p_cols": existing_p_cols,
		"q_cols": existing_q_cols,
		"n_cols": existing_n_cols
	}

def has_data(column_data, sample_size=20):
	"""Check if column has meaningful data"""
	return (column_data.head(sample_size).notna() & (column_data.head(sample_size) != "")).any()

def smart_format(value):
	"""Format to 3 significant digits"""
	if pd.isna(value) or not np.isfinite(value):
		return None
	return 0 if value == 0 else float(f"{value:.3g}")

# Sort GRIN2 data by minimum p-value across all types. If a gene meets the threshold in any type, it should be included
def sort_grin2_data(data):
    p_cols = get_sig_values(data)["p_cols"]
    valid_p_cols = [col for col in p_cols if has_data(data[col])]
    
    if not valid_p_cols:
        raise ValueError("No p-value columns with data found")
    
    min_p_values = data[valid_p_cols].min(axis=1)
    return data.iloc[min_p_values.argsort()]

def get_user_friendly_label(col_name, lesion_type_map):
	"""Convert column names to user-friendly labels"""
	# Constellation pattern: p1.nsubj, p2.nsubj, etc.
	# Note: Assumes single-digit constellation numbers (p1-p9), not double-digit like p10
	if len(col_name) > 1 and col_name[0] in 'pq' and col_name[1].isdigit() and col_name.endswith('.nsubj'):
		num = int(col_name[1])
		pq = 'P-value' if col_name[0] == 'p' else 'Q-value'
		return f"{pq} ({num} Lesion Type{'s' if num > 1 else ''})"
	
	# Data type patterns
	patterns = {
		'p.nsubj.': 'P-value',
		'q.nsubj.': 'Q-value',
		'nsubj.': 'Subject Count'
	}
	for prefix, label in patterns.items():
		if col_name.startswith(prefix):
			lesion_type = col_name[len(prefix):]
			if lesion_type in lesion_type_map:
				return f"{label} ({lesion_type_map[lesion_type]})"
	
	return col_name

def simple_column_filter(sorted_results, num_rows, lesion_type_map, blacklist_flag=None):
	"""Generate columns and rows for topGeneTable"""
	result = get_sig_values(sorted_results)
	p_cols, q_cols, n_cols = result["p_cols"], result["q_cols"], result["n_cols"]
	
	# Check data availability once
	data_type_has_data = [has_data(sorted_results[p_cols[i]]) for i in range(len(p_cols))]
	constellation_exists = [
		f'p{i}.nsubj' in sorted_results.columns and f'q{i}.nsubj' in sorted_results.columns
		for i in range(1, 6)
	]

	# Bidirectional-artifact flag: a gene significant for both gain AND loss. Only
	# applicable when both q-value columns exist; NaN q-values compare False, so a
	# gene with a missing q-value is correctly not flagged.
	has_gain_loss = {'q.nsubj.gain', 'q.nsubj.loss'} <= set(sorted_results.columns)
	if has_gain_loss:
		g = sorted_results['q.nsubj.gain'].iloc[:num_rows]
		l = sorted_results['q.nsubj.loss'].iloc[:num_rows]
		bidirectional_flag = (g < BIDIRECTIONAL_ALPHA) & (l < BIDIRECTIONAL_ALPHA)

	# Gene-family artifact label (symbol-based; always available). Shows the
	# family acronym (OR/HLA/MUC/...) for artifact-prone families, else "No".
	gene_family = sorted_results['gene'].iloc[:num_rows].map(lambda s: classify_gene_family(s) or "No")

	# Build columns
	columns = [
		{"label": "Gene", "sortable": True},
		{"label": "Chromosome", "sortable": True}
	]
	if has_gain_loss:
		columns.append({"label": "Bidirectional Artifact", "sortable": True})
	if blacklist_flag is not None:
		columns.append({"label": "Blacklist/Segdup", "sortable": True})
	columns.append({"label": "Gene Family", "sortable": True})

	# Add data type columns - safely check n_cols length
	for i, has_data_flag in enumerate(data_type_has_data):
		if has_data_flag and i < len(n_cols):
			columns.extend([
				{"label": get_user_friendly_label(p_cols[i], lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(q_cols[i], lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(n_cols[i], lesion_type_map), "sortable": True}
			])
	
	# Add constellation columns
	for i, exists in enumerate(constellation_exists, 1):
		if exists:
			columns.extend([
				{"label": get_user_friendly_label(f"p{i}.nsubj", lesion_type_map), "sortable": True},
				{"label": get_user_friendly_label(f"q{i}.nsubj", lesion_type_map), "sortable": True}
			])
	
	# Build subset of columns to extract - safely check n_cols length
	subset_cols = ['gene', 'chrom']
	for i, has_data_flag in enumerate(data_type_has_data):
		if has_data_flag and i < len(n_cols):
			subset_cols.extend([p_cols[i], q_cols[i], n_cols[i]])
	
	for i, exists in enumerate(constellation_exists, 1):
		if exists:
			subset_cols.extend([f'p{i}.nsubj', f'q{i}.nsubj'])
	
	# Extract only needed rows and columns at once
	subset_df = sorted_results.iloc[:num_rows][subset_cols]
	
	# Build row data
	rows = []
	for idx in range(num_rows):
		row_vals = subset_df.iloc[idx]
		row_data = [
			{"value": row_vals["gene"]},
			{"value": row_vals["chrom"]}
		]
		if has_gain_loss:
			row_data.append({"value": "Yes" if bool(bidirectional_flag.iloc[idx]) else "No"})
		if blacklist_flag is not None:
			row_data.append({"value": "Yes" if bool(blacklist_flag.iloc[idx]) else "No"})
		row_data.append({"value": gene_family.iloc[idx]})

		# Add data type values - safely check n_cols length
		for i, has_data_flag in enumerate(data_type_has_data):
			if has_data_flag and i < len(n_cols):
				row_data.extend([
					{"value": smart_format(row_vals[p_cols[i]])},
					{"value": smart_format(row_vals[q_cols[i]])},
					{"value": smart_format(row_vals[n_cols[i]])}
				])
		
		# Add constellation values
		for i, exists in enumerate(constellation_exists, 1):
			if exists:
				row_data.extend([
					{"value": smart_format(row_vals[f'p{i}.nsubj'])},
					{"value": smart_format(row_vals[f'q{i}.nsubj'])}
				])
		
		rows.append(row_data)
	
	return {"columns": columns, "rows": rows}

try:
	# 1. Parse input
	json_input = sys.stdin.read().strip()
	if not json_input:
		write_error("No input data provided")
		sys.exit(1)
	
	input_data = json.loads(json_input)
	lesion_type_map = input_data.get("lesionTypeMap")
	if not lesion_type_map:
		write_error("lesionTypeMap not provided")
		sys.exit(1)
	# Optional artifact-region BEDs (segdup, ENCODE blacklist) for the
	# Blacklist/Segdup overlap flag. Absent/unreadable -> column is omitted.
	artifact_beds = input_data.get("artifactBeds") or []
	
	# 2. Load gene annotations
	with sqlite3.connect(input_data["genedb"]) as con:
		gene_anno = pd.read_sql_query("SELECT name, chr, start, stop FROM gene2coord", con)
	
	if gene_anno.empty:
		write_error("No data in gene2coord table")
		sys.exit(1)
	
	# Remove header row if present and process
	gene_anno = gene_anno[
		~((gene_anno["name"] == "name") & (gene_anno["chr"] == "chr"))
	].assign(
		start=lambda x: pd.to_numeric(x["start"], errors="coerce").astype("int64"),
		stop=lambda x: pd.to_numeric(x["stop"], errors="coerce").astype("int64"),
		chr=lambda x: x["chr"].apply(lambda c: c if c.startswith("chr") else f"chr{c}")
	).rename(columns={
		"name": "gene", "chr": "chrom", "start": "loc.start", "stop": "loc.end"
	})[["gene", "chrom", "loc.start", "loc.end"]]
	
	# 3. Create chromosome size table
	chromosomelist = input_data["chromosomelist"]
	chrom_size = pd.DataFrame({
		"chrom": list(chromosomelist.keys()),
		"size": pd.to_numeric(list(chromosomelist.values())).astype("int64")
	}).assign(
		sort_key=lambda x: x["chrom"].map(lambda c: int(c[3:]) if c.startswith("chr") and c[3:].isdigit() 
		                                   else {"chrX": 23, "chrY": 24}.get(c, 100))
	).sort_values("sort_key").drop(columns="sort_key")
	
	# 4. Parse lesion data
	lesion_array = json.loads(input_data["lesion"])
	if not lesion_array:
		write_error("No lesion data provided")
		sys.exit(1)
	
	lesion_df = pd.DataFrame(
		lesion_array, 
		columns=["ID", "chrom", "loc.start", "loc.end", "lsn.type"]
	).astype({
		"ID": str, "chrom": str, 
		"loc.start": "int64", "loc.end": "int64", 
		"lsn.type": str
	}).assign(
		chrom=lambda x: x["chrom"].apply(lambda c: c if c.startswith("chr") else f"chr{c}")
	)
	
	lesion_counts = lesion_df["lsn.type"].value_counts()
	
	# Lesion types are the keys of lesionTypeMap (e.g. "mutation", "gain", "loss")
	lesion_types = list(lesion_type_map.keys())
	
	# 5. Run GRIN2
	grin_results = grin_stats(lesion_df, gene_anno, chrom_size)
	# grin_results = timed_grin_stats(lesion_df, gene_anno, chrom_size)
	if not isinstance(grin_results, dict):
		write_error("grin_stats returned invalid results")
		sys.exit(1)
	
	# 6. Sort results and build gene hits payload for Rust
	sorted_results = sort_grin2_data(grin_results["gene.hits"])

	type_cols = [
		f'{prefix}.{t}'
		for t in lesion_types
		for prefix in ['nsubj', 'q.nsubj']
		if f'{prefix}.{t}' in sorted_results.columns
	]
	gene_hits_cols = ['gene', 'chrom', 'loc.start', 'loc.end'] + type_cols
	gene_hits_df = sorted_results[gene_hits_cols]
	# Replace NaN with None so JSON serialization yields nulls (not NaN, which is invalid JSON)
	gene_hits = gene_hits_df.astype(object).where(pd.notna(gene_hits_df), None).to_dict(orient='records')

	# 7. Generate table
	max_genes = input_data.get("maxGenesToShow", 500)
	num_rows = min(len(sorted_results), max_genes)
	# Flag displayed genes whose span is largely within a segdup/blacklist region
	blacklist_flag = compute_blacklist_flag(sorted_results.iloc[:num_rows], artifact_beds)
	table_result = simple_column_filter(sorted_results, num_rows, lesion_type_map, blacklist_flag)

	# 8. Output response
	print(json.dumps({
		"topGeneTable": table_result,
		"totalGenes": len(sorted_results),
		"showingTop": num_rows,
		"lesionCounts": {"byType": lesion_counts.to_dict()},
		"memory": grin_results.get("memory_profile", {}),
		"geneHits": gene_hits
	}))

except json.JSONDecodeError as e:
	write_error(f"Invalid JSON: {str(e)}")
	sys.exit(1)
except Exception as e:
	write_error(f"Unexpected error: {str(e)}")
	sys.exit(1)