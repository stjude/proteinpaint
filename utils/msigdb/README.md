# Building a sqlite db to store MSigDB info

## Processing Steps

### STEP 1

Download MSigDB XML file.
Go to http://www.gsea-msigdb.org/gsea/downloads.jsp#msigdb, may need to log in with email.
At section "MSigDB", find `ZIPped Human MSigDB file set` and download the zip file.
Unzip the zip file to release a folder named like `msigdb_v2022.1.Hs_files_to_download_locally/`
Find a big XML file inside named like `msigdb_v2022.1.Hs.xml`

run script:
```bash
cd ~/dev/proteinpaint/utils/msigdb/
node msigdb.js ~/data/tp/msigdb/msigdb_v2022.1.Hs_files_to_download_locally/msigdb_v2022.1.Hs.xml ~/data/tp/msigdb/
```
The following files are made at current directory:
1. "phenotree", as input to buildTermdb.bundle.js
2. "term2genes"
3. "termhtmldef"


### STEP 2
```bash
cd ../termdb/
node buildTermdb.bundle.js \
	phenotree=/Users/xzhou1/data/tp/msigdb/phenotree \
	termHtmlDef=/Users/xzhou1/data/tp/msigdb/termhtmldef  \
	term2genes=/Users/xzhou1/data/tp/msigdb/term2genes \
	dbfile=/Users/xzhou1/data/tp/msigdb/db
```


### STEP 3
Restart pp server and test at http://localhost:3000/?termdb={%22vocab%22:{%22dslabel%22:%22msigdb%22,%22genome%22:%22hg38%22}}


## Examples

```bash
H > HALLMARK_ADIPOGENESIS

<GENESET STANDARD_NAME="HALLMARK_ADIPOGENESIS" SYSTEMATIC_NAME="M5905" HISTORICAL_NAME="" ORGANISM="Homo sapiens" PMID="26771021" AUTHORS="Liberzon A,Birger C,Thorvaldsdóttir H,Ghandi M,Mesirov JP,Tamayo P." GEOID="" EXACT_SOURCE="" GENESET_LISTING_URL="" EXTERNAL_DETAILS_URL="" CHIP="HUMAN_GENE_SYMBOL" CATEGORY_CODE="H" SUB_CATEGORY_CODE="" CONTRIBUTOR="Arthur Liberzon" CONTRIBUTOR_ORG="MSigDB Team" DESCRIPTION_BRIEF="Genes up-regulated during adipocyte differentiation (adipogenesis)." DESCRIPTION_FULL="" TAGS="" MEMBERS="FABP4,ADIPOQ,PPARG,LIPE,DGAT1,LPL,CPT2,CD36,GPAM,ADIPOR2,ACAA2,ETFB,ACOX1,ACADM,HADH,IDH1
```

```bash
C2 > CGP > ABBUD_LIF_SIGNALING_1_DN

<GENESET STANDARD_NAME="ABBUD_LIF_SIGNALING_1_DN" SYSTEMATIC_NAME="M1423" HISTORICAL_NAME="" ORGANISM="Mus musculus" PMID="14576184" AUTHORS="Abbud RA,Kelleher R,Melmed S" GEOID="" EXACT_SOURCE="Table 2" GENESET_LISTING_URL="" EXTERNAL_DETAILS_URL="" CHIP="MOUSE_SEQ_ACCESSION" CATEGORY_CODE="C2" SUB_CATEGORY_CODE="CGP"
```

```bash
C2 > CP > CP:BIOCARTA > BIOCARTA_41BB_PATHWAY

<GENESET STANDARD_NAME="BIOCARTA_41BB_PATHWAY" SYSTEMATIC_NAME="M2064" HISTORICAL_NAME="" ORGANISM="Homo sapiens" PMID="" AUTHORS="" GEOID="" EXACT_SOURCE="" GENESET_LISTING_URL="" EXTERNAL_DETAILS_URL="https://data.broadinstitute.org/gsea-msigdb/msigdb/biocarta/human/h_41BBPathway.gif" CHIP="Human_RefSeq" CATEGORY_CODE="C2" SUB_CATEGORY_CODE="CP:BIOCARTA" 
```

## Parsing Logic

only parse lines starting with `"<GENESET"`
fields of each line:
- STANDARD_NAME
	term id
- DESCRIPTION_BRIEF
	not used
- ORGANISM
	only limit to "Homo sapiens"
- CATEGORY_CODE
	level 1
- SUB_CATEGORY_CODE
	level 2, or
	level 2:3
- MEMBERS
	list of genes, sometimes symbols, sometimes ENSG
- MEMBERS_SYMBOLIZED
	list of symbols
