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
read_json_start <- Sys.time()
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
read_json_stop <- Sys.time()
print (paste0("Time to read json:", read_json_stop - read_json_start))

case_sample_list <- c()
control_sample_list <- c()
if (exists(input$storage_type)==FALSE) {
    if (input$storage_type == "HDF5") {
        #print(h5ls(input$input_file))
        geneIDs <- h5read(input$input_file, "gene_names")
        geneSymbols <- h5read(input$input_file, "gene_symbols")
        samples <- h5read(input$input_file, "samples")

        samples_indicies <- c()
        for (sample in cases) {
            sample_index <- which(samples == sample)
            if (length(sample_index) == 1) {
                samples_indicies <- c(samples_indicies,sample_index)
                case_sample_list <- c(case_sample_list,sample)
            } else {
                print (paste(sample,"not found"))
                quit(status = 1)
            }
        }

        for (sample in controls) {
            sample_index <- which(samples == sample)
            if (length(sample_index) == 1) {
                samples_indicies <- c(samples_indicies,sample_index)
                control_sample_list <- c(control_sample_list,sample)
            } else {
                print (paste(sample,"not found"))
                quit(status = 1)
            }
        }
        read_counts <- t(h5read(input$input_file,"counts",index=list(samples_indicies, 1:length(geneIDs))))

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
print ("case_sample_list:")
print (case_sample_list)
print ("control_sample_list:")
print (control_sample_list)
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

if (length(input$conf1) == 0) { # No adjustment of confounding factors
      calculate_dispersion_time_start <- Sys.time()
      suppressWarnings({
        suppressMessages({
            dge <- estimateDisp(y = y)
        })
      })
      calculate_dispersion_time_stop <- Sys.time()
      print (paste0("Dispersion Time:",calculate_dispersion_time_stop - calculate_dispersion_time_start))
      calculate_exact_test_time_start <- Sys.time()
      et <- exactTest(object = dge)
      calculate_exact_test_time_stop <- Sys.time()
      print (paste0("Exact Time:",calculate_exact_test_time_stop - calculate_exact_test_time_start))
} else { # Adjusting for confounding factors. This has been adapted based on the protocol described here: http://larionov.co.uk/deg_ebi_tutorial_2020/edger-analysis-1.html#calculate-degs
    y$samples$conditions <- conditions
    y$samples$conf1 <- input$conf1
    print ("y$samples")
    print (y$samples)
    calculate_model_start <- Sys.time()
    design <- model.matrix(~ conf1 + conditions, data = y$samples)
    calculate_model_stop <- Sys.time()
    print (paste0("Time for making design matrix:", calculate_model_stop - calculate_model_start))
    calculate_dispersion_time_start <- Sys.time()
    y <- estimateDisp(y, design)
    calculate_dispersion_time_stop <- Sys.time()
    print (paste0("Dispersion Time:",calculate_dispersion_time_stop - calculate_dispersion_time_start))
    # Fit the model
    calculate_fit_time_start <- Sys.time()
    #fit <- glmQLFit(y, design)
    fit <- glmFit(y, design)
    calculate_fit_time_stop <- Sys.time()
    print (paste0("Fit time:",calculate_fit_time_stop - calculate_fit_time_start))
    # Calculate the test statistics
    calculate_test_statistics_start <- Sys.time()
    #et <- glmQLFTest(fit, coef = ncol(design))
    et <- glmLRT(fit, coef = 2)  # coef = 2 corresponds to the 'treatment' vs 'control' comparison
    calculate_test_statistics_stop <- Sys.time()
    print (paste0("Test statistics time:",calculate_test_statistics_stop - calculate_test_statistics_start))
}
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
#write_csv(output,"DE_output.txt")
cat(paste0("adjusted_p_values:",toJSON(output)))

#output_json <- toJSON(output)
#print ("output_json")
#output_file <- paste0(input$output_path,"/r_output.txt")
#print (output_file)
#cat(output_json, file = output_file)

#top_degs = topTags(object = et, n = "Inf")
#print ("top_degs")
#print (top_degs)
