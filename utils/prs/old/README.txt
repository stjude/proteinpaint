#################################
# PRS pipeline
#################################


########## Overview #############

Pipeline to compute PRS scores of SJLIFE and CCSS samples using a given set of variants and their effect weights.


########### Input ###############

The input to the PRS pipeline should be a variant scoring file that contains the variants and their effect weights. Scoring files can be downloaded from the PGS catalog (https://www.pgscatalog.org/) and inputted directly into the pipeline. Custom variant scoring files can also be provided and these should follow the formatting guidelines described in the PGS catalog (see: https://www.pgscatalog.org/downloads/#dl_ftp).


######## Pipeline steps #########

Pre-process the variants
    - Determine the hg38 coordinates of the variants
    - Discard duplicated variants
    - Discard non-SNP variants (e.g. indels)
    - Discard non-autosomal SNPs
    - Discard strand-ambiguous SNPs
    - Match variants to SJLIFE+CCSS variants

Compute PRS scores of SJLIFE and CCSS samples
    - Prior to PRS computation, SJLIFE and CCSS samples are divided by ancestry (only samples of European, African, or Asian ancestry are considered)
    - PRS scores are then computed separately for each ancestry group, using the set of pre-processed variants.    
    - Variants undergo additional quality control during PRS computation. Only variants that meet the following criteria will be considered for PRS computation:
        - Missing call rate < 10%
        - HWE p-value > 1e-6
        - Effect allele frequency > 1% (optional)
            - This cutoff is optional. By default, the pipeline will compute PRS scores with and without this cutoff.


############ Usage ##############

This pipeline is designed to be run on HPC.

Before running the pipeline, create a new working directory for the PRS analysis. Store the input variant scoring file in this directory and run the pipeline from this directory. All output files of the pipeline will be stored in this working directory.

Run the pipeline as follows:

    bash path/to/prs_pipeline.sh <variant scoring file> <genome build>

Arguments:
    <variant scoring file>: file containing the input variants and their effect weights. This file should be stored in the working directory of the PRS analysis.
    <genome build>: genome build of variants (hg19 or hg38). If genome build is hg19, then variant coordinates will be lifted over to hg38 coordinates.


######## Updating SJLIFE PRS database ###########

After the PRS pipeline has finished, the new PRS data needs to be added to the SJLIFE PRS database.

The PRS database is updated by using a PRS track table, which tracks all of the PRS datasets that should be included in the PRS database. This table contains 3 tab-delimited columns: "prs", "ancestry", and "tp_path". The "prs" column indicates the name of the PRS dataset. The "ancestry" column indicates the ancestry of the PRS. The parent terms of the PRS are comma-delimited and proceed from general to specific. The "tp_path" column indicates the path to the directory that contains the PRS data. This path needs to be relative to the "tp" directory on HPC.

Here is an example of a PRS track table:

    prs         ancestry                          tp_path
    PGS000001   parent1,parent2,parent3           path/to/prs/dir
    PGS000002   parent1,parent2,parent3           path/to/prs/dir
    PGS000003   parent1,parent2,parent3,parent4   path/to/prs/dir


Add the relevant information of the new PRS dataset to this track table.

Then, re-build the PRS database files using the information in the PRS track table by running the following:

    node make_prs_db.bundle.js path/to/track_table.prs

This script will re-create the "ancestry.prs", "annotation.scores", and "termdb.prs" files in the PRS db folder on HPC ("tp/files/hg38/sjlife/clinical/PRS/").


############ Notes ##############

The script for computing PRS scores needs to be bundled so that it can run on HPC. To bundle the script, run the following from the pp root directory:

    npx webpack --config=utils/prs/webpack.config.computeprs.js

The script for creating PRS database files needs to be bundled in order for it to be run on HPC. To bundle the script, run the following from the pp root directory:

    npx webpack --config=utils/prs/webpack.config.makeprsdb.js


