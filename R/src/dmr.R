# Test syntax: cat ~/sjpp/test.txt | time Rscript edge.R

# Load required packages
time_libs <- system.time({
suppressWarnings({
  library(jsonlite)
  library(rhdf5)
  library(DMRcate)
  library(limma)
  library(GenomicRanges)
})
})

time_parse_json <- system.time({
  
read_json_samples <- function(){
    # Open stdin connection
  con <- file("stdin", "r")
  on.exit(close(con))

  # Try reading all lines from stdin
  json_lines <- tryCatch({
    readLines(con, warn = FALSE)
  }, error = function(e) NULL)

  # If no input, return NULL
  if (is.null(json_lines) || length(json_lines) == 0 || all(nchar(json_lines) == 0)) {
    return(NULL)
  }
  
  json_input <- paste(json_lines, collapse = "")  # Combine lines into a single string
  parsed <- fromJSON(json_input)
  
  # Extract metadata
  query_chrom = parsed$chr
  query_start = parsed$start
  query_end = parsed$stop
  
  cat("Query Genomic range: ", query_chrom, ": [", query_start, ", ", query_end, "]\n")
  # Convert groups to data frames
  group1_df <- as.data.frame(parsed$group1)
  group2_df <- as.data.frame(parsed$group2)
  
  # Add a group column
  group1_df$group <- "group1"
  group2_df$group <- "group2"
  
  # Combine both groups
  all_samples <- rbind(group1_df, group2_df)
  
  # return parsed input
  return(list(
    query_chrom = query_chrom,
    query_start = query_start,
    query_end   = query_end,
    all_samples = all_samples
  ))
}
})

# Report timings
cat("\n--- Timing Summary ---\n")
cat(sprintf("Library loading : %.3f sec elapsed\n", time_libs["elapsed"]))
cat(sprintf("Prase JSON      : %.3f sec elapsed\n", time_parse_json["elapsed"]))
cat(sprintf("Total           : %.3f sec elapsed\n", time_libs["elapsed"] + time_parse_json["elapsed"]))

process_genomic_queries <- function(h5file, all_samples, query_chrom, query_start, query_end, verbose = FALSE) {
    if (!file.exists(h5file)) stop("HDF5 file does not exist: ", h5file)
    query_samples <- c(all_samples$sample)
    # Open HDF5 file
    h5 <- H5Fopen(h5file, flags = "H5F_ACC_RDONLY")
    on.exit(H5Fclose(h5))  # ensure file is closed on
    print("Read HDF5 file...")

    # Read sample metadata
    names <- h5read(h5, "meta/samples/names")
    cols  <- h5read(h5, "meta/samples/col_idx")
    cols <- cols + 1 # Since R is 1-based indexing
    start_pos <- h5read(h5, "meta/start")
    probe_ids <- h5read(h5, "meta/probe/probeID")
    cat("names:", names[1:5], "\n")
    cat("cols:", cols[1:5], "\n")
    cat("start_pos:", start_pos[1:5], "\n")
    cat("probe_ids:", probe_ids[1:5], "\n")

    # Read chromosome lengths
    chrom_lengths_json <- h5readAttributes(h5, "/")$chrom_lengths
    num_sites_per_chrom <- jsonlite::fromJSON(chrom_lengths_json)
    # Check if chromosome exists
    if (!(query_chrom %in% names(num_sites_per_chrom))) {
        stop(query_chrom, " does not exist in the HDF5 file.")
    }

    # Compute prefix sum to get row ranges
    all_chromosomes <- names(num_sites_per_chrom)
    num_sites_pref_sum <- c(0, cumsum(unlist(num_sites_per_chrom)))

    # Get row range for chromosome
    get_row_ranges_for_chrom <- function(chrom, all_chromosomes, prefix_sum) {
        idx <- which(all_chromosomes == chrom)
        start <- prefix_sum[idx] + 1  # R is 1-based
        end <- prefix_sum[idx + 1]    
        return(c(start, end))
    }

    row_range <- get_row_ranges_for_chrom(query_chrom, all_chromosomes, num_sites_pref_sum)
    row_start <- row_range[1]
    row_end   <- row_range[2]
    target_start_pos <- start_pos[row_start:row_end]
    cat("In HDF5, for ", query_chrom, ": [", target_start_pos[1], ", ", target_start_pos[length(target_start_pos)], "]\n")
    cat("Row Index range: [", row_start, ",", row_end, "]\n")

    # Binary search equivalent: find indices for query_start and query_end
    # gives the index in target_start_pos s.t. target_start_pos[index] <= query_value
    left  <- findInterval(query_start, target_start_pos) + 1
    right <- findInterval(query_end, target_start_pos) 
    cat("After binary searching ", query_chrom, "intervals...\n")
    cat("Interval = [",left,",", right, "]\n")

    if (left > right) {
      stop("Valid Genomic Interval not found: ", query_chrom, ": [", target_start_pos[1], ",", target_start_pos[length(target_start_pos)], "]")
    }

    # Map samples to column indices
    sample_to_col <- setNames(cols, names)
    missing_samples <- setdiff(query_samples, names(sample_to_col))
    if (length(missing_samples) > 0) {
      stop("Samples not found: ", paste(missing_samples, collapse = ", "))
    }
    col_idx <- as.integer(unlist(sample_to_col[query_samples]))
    cat("Samples indices:", col_idx, "\n")
    cat("Total # of CpGs in the specified range: ", right-left + 1, "\n")
    target_probe_ids <- probe_ids[left:right]
    target_pos <- start_pos[left:right]

    # Read the beta matrix
    # Note: the HDF5 file was written using python which writes row-major order
    # But, R reads column-major order so the list() parameters are interchanged
    m_slice <- h5read(h5, "/m/values", index = list(col_idx, left:right))
    # Transposing so that rows are CpGs and cols are samples
    m_slice <- t(m_slice)
    # Ensure 2D matrix
    if (is.null(dim(m_slice))) {
      m_matrix <- matrix(m_slice, nrow = 1)
    } else {
      m_matrix <- m_slice
    }
    rownames(m_matrix) <- target_probe_ids
    colnames(m_matrix) <- query_samples

    print(dim(m_matrix))
    print(class(m_matrix))
    #cat("Probe Ids:", target_probe_ids, "\n")
    #cat("Target positions:", target_pos, "\n")
    #print(dim(m_matrix))

    # design matrix for two different groups
    n_samples <- ncol(m_matrix)
    all_samples$group <- factor(all_samples$group)
    design <- model.matrix(~ group, data = all_samples)
    print(design)


    # Fit linear model with limma
    fit <- lmFit(m_matrix, design)
    fit <- eBayes(fit)

    # Create custom annotation (since using non-IDAT input)
    gr <- GRanges(
        seqnames = rep(query_chrom, length(target_pos)),
        ranges = IRanges(start = target_pos, end = target_pos),
        names = target_probe_ids
    )

    stopifnot(is.matrix(m_matrix))
    stopifnot(nrow(m_matrix) == length(target_probe_ids))
    stopifnot(all(rownames(m_matrix) == names(gr)))
    stopifnot(ncol(m_matrix) == nrow(all_samples))
    stopifnot(all(colnames(m_matrix) == all_samples$sample))

    # Annotate CpGs for DMRcate
    myannotation <- cpg.annotate(
        datatype = "array",
        object = m_matrix,
        what = "M",
        analysis.type = "differential",
        design = design,
        coef = 2,
        fdr = 0.05,
        #arraytype = "450K",
        arraytype = "EPICv1",
        annotation = gr
    )

    # Extract DMR ranges
    dmr_ranges <- tryCatch({
        extractRanges(dmrcoutput, genome="hg38")
    }, error = function(e) {
        cat("No DMRs found in the specified range.\n")
        return(NULL)
    })

    # Handle empty result
    if (is.null(dmr_ranges) || length(dmr_ranges) == 0) {
        cat("No DMRs detected. Returning NULL.\n")
    } else {
        cat("DMRs found:\n")
        print(dmr_ranges)
    }

    #quit(save="no")

    return(dmr_ranges)
}

# Attempt to read JSON input from stdin
json_result <- read_json_samples()
if (is.null(json_result)) {
  cat("No JSON input detected. Using hard-coded values.\n")
  
  # Hard-coded genomic range
  query_chrom <- "chr1"
  query_start <- 23434
  query_end   <- 911362
  
  # Hard-coded sample groups
  group1_df <- data.frame(
    sampleId = c(1, 2, 3, 4),
    sample   = c("SJMB058496", "SJMBWES235","SJMBWES241", "SJMBWES100"),
    group    = "group1",
    stringsAsFactors = FALSE
  )
  
  group2_df <- data.frame(
    sampleId = c(5, 6, 7, 8),
    sample   = c("SJMB066945", "SJMBWES218", "SJMBWES246", "SJMB067027"),
    group    = "group2",
    stringsAsFactors = FALSE
  )
  
  all_samples <- rbind(group1_df, group2_df)
} else {
  cat("JSON input detected. Using parsed values.\n")
  query_chrom <- json_result$query_chrom
  query_start <- json_result$query_start
  query_end   <- json_result$query_end
  all_samples <- json_result$all_samples
}


hdf5_file ="/Users/pshakya/Documents/DMR_test/data/M.h5"
process_genomic_queries(hdf5_file, all_samples, query_chrom, query_start, query_end)

