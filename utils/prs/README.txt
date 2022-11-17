#################################
# PRS pipeline
#################################

This pipeline is designed to be run on HPC.

########## Overview #############

Pipeline to compute PRS scores of SJLIFE and CCSS samples and create PRS database files is documented in jupyter notebook named as prs_computing.ipynb


########### Input ###############

1. Create a working directory ( under <TP> ) and specify the full path in prs_computing.ipynb
2. Download pgs_scores_data.json from https://www.pgscatalog.org/browse/scores/, and put it under working directory
3. Specify the full path of SJLIFE.CCSS.variants.gz ( compressed and indexed SJLIFE_CCSS variants ) with 4 columns (chr, pos, ref_allele and alt_allele). The alt_allele could have more than 1 allelet sperated with ','
4. Specify the full path of samples.idmap in prs_computing.ipynb
5. Put the sample list files under working directory:
    sample.asa
    sample.ceu
    sample.yri
6. Specify the full path of pre-computed hwe test results ( compressed and indexed ):
    phwe.asa.gz
    phwe.ceu.gz
    phwe.yri.gz
7. Specify the update date in prs_computing.ipynb
8. Specify the relative path to working directory, starting from <TP>



######## Pipeline steps #########

1. PGScatalog download
    Scoring files will be downloaded from the PGS catalog (https://www.pgscatalog.org/). 

2. PRS Compute 
    Pre-process the variants
        - Discard duplicated variants
        - Discard non-SNP variants (e.g. indels)
        - Discard non-autosomal SNPs
        - Discard strand-ambiguous SNPs
    Compute PRS scores of SJLIFE and CCSS samples
        - PRS scores are then computed separately for each ancestry group
        - Variants undergo additional quality control during PRS computation. Only variants that meet the following criteria will be considered for PRS computation:
            - Missing call rate < 10%
            - HWE p-value > 1e-6
            - Effect allele frequency > 1% ( PRS will be computed with or without this cutoff )

3. File production
    a. generate track_table.prs
    b. create PRS database files
        -input: track_table.prs
        -make_prs_db.bundle.js: node script used to create PRS database files. It needs to be bundled in order for it to be run on HPC. To bundle the script, run the following from the pp root directory:
            npx webpack --config=utils/prs/webpack.config.makeprsdb.js


