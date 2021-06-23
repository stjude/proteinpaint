=================
PRS pipeline
=================

Pipeline to compute PRS scores for SJLIFE+CCSS samples based on a specified PGS dataset from the PGS catalog. This pipeline will perform the following steps (for further details about each step, see the "prs_pipeline.sh" script):

    - Download the specified PGS dataset from the PGS catalog
    - Convert the coordinates of PGS variants to hg38 coordinates
    - Perform QC on the PGS variants
    - Match the PGS variants to SJLIFE+CCSS variants
    - Compute PRSs of SJLIFE+CCSS samples based on the processed PGS variants and their effect weights (for further details, see the "prs_pipeline.sh" script)
        - PRSs are computed separately for each major ancestry group (European, African, and Asian).
        - PRSs are computed with and without a minor allele frequency (MAF) cutoff of 1%.


Before running the pipeline, create a new directory for storing all output files of the pipeline.


Run the pipeline as follows:

    bash prs_pipeline.sh <pgsID> <outDir>

Arguments:
    <pgsID>: PGS identifier (e.g. PGS000332)
    <outDir>: directory to store output files
