#!/bin/bash
#
# Download and prepare regulatory annotation BED files for GPDM analysis.
#
# This script downloads two annotation sources and prepares them as
# tabix-indexed BED files under the ProteinPaint anno/ directory:
#
#   1. UCSC CpG Islands (cpgIslandExt) → anno/cpgIsland.hg38.gz
#   2. ENCODE cCREs (V3) → anno/encodeCCRE.hg38.gz
#
# Prerequisites:
#   - bgzip (from htslib)
#   - tabix (from htslib)
#   - curl or wget
#
# Usage:
#   ./download_regulatory_annotations.sh /path/to/tpmasterdir
#
# The tpmasterdir is the ProteinPaint data directory (serverconfig.tpmasterdir).
# Files will be written to $tpmasterdir/anno/

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <tpmasterdir>"
    echo "  tpmasterdir: ProteinPaint data directory (serverconfig.tpmasterdir)"
    exit 1
fi

TPDIR="$1"
ANNODIR="$TPDIR/anno"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$ANNODIR"

echo "=== Downloading CpG Islands (hg38) ==="
# UCSC cpgIslandExt table: chrom, chromStart, chromEnd, name, ...
# We extract the first 4 columns as a simple BED file.
curl -sS "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cpgIslandExt.txt.gz" \
    | gunzip -c \
    | awk -F'\t' 'BEGIN{OFS="\t"} {print $2, $3, $4, $5}' \
    | sort -k1,1 -k2,2n \
    > "$TMPDIR/cpgIsland.hg38.bed"

bgzip -c "$TMPDIR/cpgIsland.hg38.bed" > "$ANNODIR/cpgIsland.hg38.gz"
tabix -p bed "$ANNODIR/cpgIsland.hg38.gz"
echo "  -> $ANNODIR/cpgIsland.hg38.gz"
echo "  -> $(wc -l < "$TMPDIR/cpgIsland.hg38.bed") CpG islands"

echo ""
echo "=== Downloading ENCODE cCREs (hg38, V3) ==="
# ENCODE cCRE V3 BED file: chrom, start, end, accession, classification
# Classifications: PLS (Promoter-like), pELS (proximal Enhancer-like),
# dELS (distal Enhancer-like), CTCF-only, DNase-H3K4me3
curl -sS "https://downloads.wenglab.org/V3/GRCh38-cCREs.bed" \
    | sort -k1,1 -k2,2n \
    > "$TMPDIR/encodeCCRE.hg38.bed"

bgzip -c "$TMPDIR/encodeCCRE.hg38.bed" > "$ANNODIR/encodeCCRE.hg38.gz"
tabix -p bed "$ANNODIR/encodeCCRE.hg38.gz"
echo "  -> $ANNODIR/encodeCCRE.hg38.gz"
echo "  -> $(wc -l < "$TMPDIR/encodeCCRE.hg38.bed") cCREs"

echo ""
echo "Done. Annotation files ready for GPDM analysis:"
echo "  $ANNODIR/cpgIsland.hg38.gz (+.tbi)"
echo "  $ANNODIR/encodeCCRE.hg38.gz (+.tbi)"
echo ""
echo "=== Next step: Compute dataset-specific priors ==="
echo "For each dataset with a dnaMeth.h5 file, run:"
echo ""
echo "  python proteinpaint/python/src/compute_methylation_priors.py \\"
echo "    --h5 <tpmasterdir>/files/<genome>/<dataset>/dnaMeth.h5 \\"
echo "    --cpg-islands $ANNODIR/cpgIsland.hg38.gz \\"
echo "    --encode-ccre $ANNODIR/encodeCCRE.hg38.gz \\"
echo "    --output <tpmasterdir>/files/<genome>/<dataset>/dnaMeth.priors.json"
echo ""
echo "Then add to your dataset config:"
echo "  dnaMethylation: {"
echo "    file: 'files/<genome>/<dataset>/dnaMeth.h5',"
echo "    priorsFile: 'files/<genome>/<dataset>/dnaMeth.priors.json',"
echo "    ..."
echo "  }"
