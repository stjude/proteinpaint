# GDC plot launchers

These code are specifically built for various PP features to work in GDC https://portal.gdc.cancer.gov/
Each file corresponds to a card in the GDC Analysis Center (separately coded in GDC Frontend Framework https://github.com/NCI-GDC/gdc-frontend-framework)

bam.js
	sequence reads viz
    bam slicing download
lollipop.js
	proteinpaint
geneExpClustering.js
	gene expression clustering
oncomatrix.js
	oncomatrix
maf.js
	cohort MAF
singlecell.js
	single cell rnaseq (not released)


From a GFF card, it calls runpp({ purposeSpecificKey:{} })
and such purpose-specific key will trigger client/src/app.js to load a script file from this folder,
and this script file will load a PP plot which works for both gdc and non-gdc datasets.

These scripts will supply gdc-specific data and configurations.
