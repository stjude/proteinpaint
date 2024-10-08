# Usage: echo <in_json> | Rscript edge.R > <out_json>

#   in_json: [string] input data in JSON format. Streamed through stdin.
#   out_json: [string] clustering results in JSON format. Streamed to stdout.


# json='{"case":"SJMB066856,SJMB069601,SJMB030827,SJMB030838,SJMB031131,SJMB031227,SJMB077221,SJMB077223","control":"SJMB069596,SJMB069587,SJMB074736,SJMB030488,SJMB030825,SJMB031110,SJMB032998,SJMB033002","input_file":"/Users/rpaul1/pp_data/files/hg38/sjmb12/rnaseq/geneCounts.txt"}' && time echo $json | Rscript edge.R

# json='{"case":"SJMB030827,SJMB030838,SJMB064540,SJMB064538,SJMB064520,SJMB064535,SJMB031131,SJMB031227","control":"SJMB030488,SJMB030825,SJMB064537,SJMB064510,SJMB064533,SJMB064534,SJMB031110","input_file":"/Users/rpaul1/pp_data/files/hg38/sjmb12/rnaseq/geneCounts.txt"}' && time echo $json | Rscript edge.R

# Checking if all R packages are installed or not, if not installing each one of them

#jsonlite_path <- system.file(package='jsonlite')
#if (nchar(jsonlite_path) == 0) {
#  install.packages("jsonlite", repos='https://cran.case.edu/')
#}
#
#edgeR_path <- system.file(package='edgeR')
#if (nchar(edgeR_path) == 0) {
#  BiocManager::install("edgeR")
#}
#
#readr_path <- system.file(package='readr')
#if (nchar(readr_path) == 0) {
#  install.packages("readr", repos='https://cran.case.edu/')
#}


library(jsonlite)
library(rhdf5)
library(stringr)
library(readr)
suppressWarnings({
    suppressPackageStartupMessages(library(edgeR))
    suppressPackageStartupMessages(library(dplyr))
})

con <- file("stdin", "r")
json <- readLines(con, warn=FALSE)
close(con)
input <- fromJSON(json)
#print (input)
#print (input$output_path)

cases <- unlist(strsplit(input$case, ","))
controls <- unlist(strsplit(input$control, ","))
combined <- c("geneID","geneSymbol",cases,controls)
#data %>% select(all_of(combined))
#read_file_time_start <- Sys.time()

if (exists(input$storage_type)) {
    if (input$storage_type == "HDF5") {
        geneIDs <- h5read(input$input_file, "gene_names")
        geneSymbols <- h5read(input$input_file, "gene_symbols")
        samples <- h5read(input$input_file, "samples")
        print ("geneIDs")
        print (geneIDs)
    } else if (input$storage_type == "text") {    
        suppressWarnings({
          suppressMessages({
        read_counts <- read_tsv(input$input_file, col_names = TRUE, col_select = combined)
          })
        })
        geneIDs <- unlist(read_counts[1])
        geneSymbols <- unlist(read_counts[2])
        read_counts <- select(read_counts, -geneID)
        read_counts <- select(read_counts, -geneSymbol)
    } else {
        print ("Unknown storage type")
    }    
} else { # If not defined, parse data from a text file
    suppressWarnings({
      suppressMessages({
    read_counts <- read_tsv(input$input_file, col_names = TRUE, col_select = combined)
      })
    })
    geneIDs <- unlist(read_counts[1])
    geneSymbols <- unlist(read_counts[2])
    read_counts <- select(read_counts, -geneID)
    read_counts <- select(read_counts, -geneSymbol)
}    

#read_file_time_stop <- Sys.time()
#print (read_file_time_stop - read_file_time_start)

diseased <- rep("Diseased", length(cases))
control <- rep("Control", length(controls))
conditions <- c(diseased, control)
tabs <- rep("\t",length(geneIDs))
gene_id_symbols <- paste0(geneIDs,tabs,geneSymbols)
y <- DGEList(counts = as.matrix(read_counts), group = conditions, genes = gene_id_symbols)
keep <- filterByExpr(y, min.count = input$min_count, min.total.count = input$min_total_count)
y <- y[keep, keep.lib.sizes = FALSE]
y <- calcNormFactors(y, method = "TMM")
#print (y)
#calculate_DE_time_start <- Sys.time()
suppressWarnings({
  suppressMessages({
      dge <- estimateDisp(y = y)
  })
})
et <- exactTest(object = dge)
calculate_DE_time_stop <- Sys.time()
#print ("Time to calculate DE")
#print (calculate_DE_time_stop - calculate_DE_time_start)
#print (et)
logfc <- et$table$logFC
logcpm <- et$table$logCPM
pvalues <- et$table$PValue
genes_matrix <- str_split_fixed(unlist(et$genes),"\t",2)
geneids <- unlist(genes_matrix[,1])
genesymbols <- unlist(genes_matrix[,2])
adjust_p_values <- p.adjust(pvalues, method = "fdr")

output <- data.frame(geneids,genesymbols,logfc,-log10(pvalues),-log10(adjust_p_values))
names(output)[1] <- "gene_name"
names(output)[2] <- "gene_symbol"
names(output)[3] <- "fold_change"
names(output)[4] <- "original_p_value"
names(output)[5] <- "adjusted_p_value"

toJSON(output)
#output_json <- toJSON(output)
#print ("output_json")
#output_file <- paste0(input$output_path,"/r_output.txt")
#print (output_file)
#cat(output_json, file = output_file)

#top_degs = topTags(object = et, n = "Inf")
#print ("top_degs")
#print (top_degs)
