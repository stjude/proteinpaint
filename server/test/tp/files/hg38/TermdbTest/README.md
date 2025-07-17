# Steps for creating single cell data for TermdbTest

Generate UMAP data


```bash
scp hpc:~/tp/files/hg38/ash/transcriptomics/ash.geneCounts.txt .

cat ash.geneCounts.txt | head -134 > sample1.genecounts.txt # Take first 100 genes
# Create raw gene counts HDF5 files
python3 scripts/select_genes_for_scRNA.py # Select first 10 columns, this creates a file sample1.10.geneCounts.txt
Rscript ~/sjpp/utils/hdf5/create_HDF5_from_text.R -i sample1.104.geneCounts.txt -o sample1.104.geneCounts.h5 -k row -c 1 -g geneSymbol -s geneSymbol -e "geneID,geneSymbol,bioType,annotationLevel" -f

Rscript ~/sjpp/utils/tsne-umap/generate_tsne_umap.R --input sample1.104.geneCounts.h5 --umap_output sample1_umap.txt --tsne_output sample1_tsne.txt
python3 scripts/insert_column.py  # Adds a column containing disease type "Blood".
```
Changed some disease labels in the final output randomly so that there are multiple disease types in the final umap output.

Create sparse HDF5 file
```bash
Rscript scripts/create_rds.R
Rscript ~/sjpp/utils/hdf5/rds_to_hdf5_converter.R -i termdb_scrna.rds -o 1_patient.h5
```


