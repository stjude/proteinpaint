# GDC plot launchers

## Background

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

## GDC login handling

In SJ portal logins, we always refresh the app fully with window.location.reload() or similar,
so that `/genomes` and `/termdb/config` responses with `{dsAuth}` and `{requiredAuth, clientAuthResult}`
are correct when starting mass app. So, the difference from non-GDC usage/portals is that `client/gdc/` 
code use `.update()` and not a full `runpp()` refresh, since GDC portal is reactive with lots of irrelevant
dispatches that has to be ignored - otherwise repetitive full refreshes would blink a lot and may create
duplicate tracks due to race condition (`bindProteinPaint()` was created to correctly handle these issues).
