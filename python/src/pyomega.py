
"""
Input JSON:
{
    fasta_sequence: Str (fasta sequences)
    max_read_alignment: int
}
Output: multiple alignment to stdout
"""
import warnings, json, sys, io
from collections import Counter

from Bio import SeqIO
from Bio.Align import PairwiseAligner
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord
from Bio.Align import MultipleSeqAlignment

import numpy as np
from scipy.cluster.hierarchy import linkage, to_tree
from scipy.spatial.distance import squareform



warnings.filterwarnings('ignore')

def write_error(msg):
    print(f"ERROR: {msg}", file=sys.stderr)

def consensus(msa):
    """Majority-vote consensus of an alignment (ignores gaps)."""
    if not msa:
        return ""
    length = len(msa[0])
    cons = []
    for pos in range(length):
        chars = [msa[i][pos] for i in range(len(msa)) if msa[i][pos] != "-"]
        if not chars:
            cons.append("-")
        else:
            cons.append(Counter(chars).most_common(1)[0][0])
    return "".join(cons)

def compute_distance_matrix(records):
    n = len(records)
    scores = np.zeros((n, n))
    seq_strs = [str(rec.seq).upper() for rec in records]
    
    aligner = PairwiseAligner()
    aligner.mode = "global"
    aligner.match_score = 1.0
    aligner.mismatch_score = 0.0
    aligner.open_gap_score = -5.0
    aligner.extend_gap_score = -1.0     # lower extension penalty helps

    # semi-global mode
    aligner.open_end_insertion_score = 0.0
    aligner.extend_end_insertion_score = 0.0
    aligner.open_end_deletion_score = 0.0
    aligner.extend_end_deletion_score = 0.0

    for i in range(n):
        for j in range(i + 1, n):
            alns = aligner.align(seq_strs[i], seq_strs[j])
            scores[i, j] = scores[j, i] = alns[0].score

    max_score = np.max(scores) if np.max(scores) > 0 else 1.0
    dist = (max_score - scores) / (max_score + 1e-9)
    np.fill_diagonal(dist, 0.0)
    return dist


def align_two_msas(msa1, msa2):
    if not msa1: return msa2
    if not msa2: return msa1

    cons1 = consensus(msa1)
    cons2 = consensus(msa2)

    aligner = PairwiseAligner()
    aligner.mode = "global"
    aligner.match_score = 1.0
    aligner.mismatch_score = 0.0
    aligner.open_gap_score = -5.0
    aligner.extend_gap_score = -1.0     # important for this example

    # semi-global mode
    aligner.open_end_insertion_score = 0.0
    aligner.extend_end_insertion_score = 0.0
    aligner.open_end_deletion_score = 0.0
    aligner.extend_end_deletion_score = 0.0


    alignments = aligner.align(cons1, cons2)
    alignment = alignments[0]

    aligned_cons1 = str(alignment[0])
    aligned_cons2 = str(alignment[1])

    # Propagate gaps
    new_msa1 = []
    for seq in msa1:
        new_seq = ""
        col_ptr = 0
        for c in aligned_cons1:
            if c != "-":
                new_seq += seq[col_ptr]
                col_ptr += 1
            else:
                new_seq += "-"
        new_msa1.append(new_seq)

    new_msa2 = []
    for seq in msa2:
        new_seq = ""
        col_ptr = 0
        for c in aligned_cons2:
            if c != "-":
                new_seq += seq[col_ptr]
                col_ptr += 1
            else:
                new_seq += "-"
        new_msa2.append(new_seq)

    return new_msa1 + new_msa2

def build_guide_tree(dist_matrix):
    """UPGMA guide tree."""
    condensed = squareform(dist_matrix)
    Z = linkage(condensed, method="average")
    return to_tree(Z)


def get_msa_from_tree(tree, original_seqs):
    """Recursively build MSA following the guide tree (preserves original order).
    [(3, 'ATGCTACGATCGA--GTACGATCGATGGTACGATCGATCG'), (1, 'ATGCTACGATCGAT-GTACGATCGATCGTACGATCGATCG'), (0, 'ATGCTACGATCGATCGTACGATCGATCGTACGATCGATCG'), (2, 'ATGCTACGATCGATCGTACGATCAATCGTACGATCGATCG')]

    """
    def recurse(node):
        if node.is_leaf():
            return [(node.id, original_seqs[node.id])]

        left_list = recurse(node.left)   # list of (original_index, aligned_str)
        right_list = recurse(node.right)

        left_seqs = [s for _, s in left_list]
        right_seqs = [s for _, s in right_list]

        merged_seqs = align_two_msas(left_seqs, right_seqs)

        # Re-attach original indices
        merged = [(left_list[i][0], merged_seqs[i]) for i in range(len(left_list))]
        merged += [(right_list[i][0], merged_seqs[len(left_list) + i]) for i in range(len(right_list))]
        return merged

    msa_with_ids = recurse(tree)
    msa_with_ids.sort(key=lambda x: x[0])  # restore input order
    return [seq for _, seq in msa_with_ids]

def write_clustal_with_wrap(msa, handle, wrap = 60, seqtype = "auto"):
    """Write Clustal output with proper conservation line (no * in gapped columns)."""
    handle.write("CLUSTAL O (PyOmega)\n\n")

    max_len = max(len(rec.id) for rec in msa)
    name_width = max_len + 2

    # Auto detect DNA/Protein
    all_chars = set("".join(str(rec.seq).upper() for rec in msa))
    is_dna = all_chars.issubset(set("ATGCN-")) if seqtype == "auto" else (seqtype == "dna")

    length = len(msa[0])
    pos = 0
    while pos < length:
        block_end = min(pos + wrap, length)

        # Write sequences
        for rec in msa:
            seq_block = str(rec.seq)[pos:block_end]
            handle.write(f"{rec.id:<{name_width}}{seq_block}\n")

        # === Improved Conservation Line ===
        cons = ""
        for i in range(pos, block_end):
            column = [str(rec.seq)[i] for rec in msa]

            # If ANY gap in the column → no conservation symbol
            if "-" in column:
                cons += " "
                continue

            # No gaps → check if all identical
            unique = set(column)
            if len(unique) == 1:
                cons += "*"
            elif not is_dna:
                # Protein: you can keep : and . if you want
                if is_strong_conserved(unique):
                    cons += ":"
                elif is_weak_conserved(unique):
                    cons += "."
                else:
                    cons += " "
            else:
                cons += " "   # DNA: only * or space

        handle.write(" " * name_width + cons + "\n\n")
        pos = block_end

def is_strong_conserved(residues):
    return any(residues.issubset(g) for g in strong_groups)

def is_weak_conserved(residues):
    return any(residues.issubset(g) for g in weak_groups)

# ================== Protein similarity groups (only used if not DNA) ==================
strong_groups = [set(x) for x in ["STA", "NEQK", "NHQK", "NDEQ", "QHRK", "MILV", "MILF", "HY", "FYW"]]
weak_groups   = [set(x) for x in ["CSA", "ATV", "SAG", "STNK", "STPA", "SGND", "SNDEQK", "NDEQHK", "NEQHRK", "FVLIM", "HFY"]]


try:
    #1. Parse input
    json_input = sys.stdin.read().strip()
    if not json_input:
        write_error("No input data provided")
    input_data = json.loads(json_input)
    fasta_sequence = input_data.get("fasta_sequence")
    if not fasta_sequence:
        write_error("fasta sequence not provided")
        sys.exit(1)
    max_read_alignment = input_data.get("max_read_alignment")
    if not max_read_alignment:
        write_error("max number of sequence not provided")
        sys.exit(1)
    try:
        max_read_alignment = int(max_read_alignment)
    except:
        write_error("max number of sequence is not a number")
        sys.exit(1)

    # alignment
    fasta_io = io.StringIO(fasta_sequence)
    records = list(SeqIO.parse(fasta_io, "fasta"))
    if not records:
        write_error("no fasta sequence found")
        sys.exit(1)

    # --maxnumseq
    if len(records) > max_read_alignment:
        records = records[:(max_read_alignment+1)]

    # --maxseqlen: 1000
    for rec in records:
        if len(rec.seq) > 1000:
            rec.seq = rec.seq[:1000]

    dist = compute_distance_matrix(records)
    tree = build_guide_tree(dist)

    seq_strs = [str(rec.seq) for rec in records]
    msa_strs = get_msa_from_tree(tree, seq_strs)

    # Build final MultipleSeqAlignment
    msa_records = [
        SeqRecord(Seq(aln_str), id=rec.id, description=rec.description)
        for rec, aln_str in zip(records, msa_strs)
    ]
    msa = MultipleSeqAlignment(msa_records)

    write_clustal_with_wrap(msa, sys.stdout, wrap=5000, seqtype="dna")

except Exception as e:
    write_error(str(e))
    sys.exit(1)


