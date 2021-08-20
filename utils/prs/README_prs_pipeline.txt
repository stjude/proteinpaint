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


This pipeline is designed to be run on HPC. 

Before running the pipeline, create a new directory for storing all output files of the pipeline.


Run the pipeline as follows:

    bash prs_pipeline.sh <pgsID> <outDir>

Arguments:
    <pgsID>: PGS identifier (e.g. PGS000332)
    <outDir>: directory to store output files


Create/update a PRS track table that tracks all finished PRS datasets. This table contains 3 tab-delimited columns: PRS name, PRS ancestry, and path to the PRS directory. For the ancestry column, parent terms are comma-delimited and proceed from general to specific. For the path column, the path is a path within the "tp" directory to the directory containing PRS results. Here is an example:

    prs         ancestry                          tp_path
    PGS000001   parent1,parent2,parent3           path/to/prs/dir
    PGS000002   parent1,parent2,parent3           path/to/prs/dir
    PGS000003   parent1,parent2,parent3,parent4   path/to/prs/dir


Use this track table to create the PRS database files by running the following:

    node make_prs_db.bundle.js prs_track_table.txt

This script will create the "ancestry.prs", "annotation.scores", and "termdb.prs" files in the PRS db folder ("tp/files/hg38/sjlife/clinical/PRS/").


=========
Notes
=========
- The script for creating PRS database files needs to be bundled in order for it to be run on HPC. To bundle the script, run the following from the pp root directory:

    npx webpack --config=utils/prs/webpack.config.makeprsdb.js


