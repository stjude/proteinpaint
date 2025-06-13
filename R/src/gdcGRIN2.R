###################
# gdcGRIN2         #
###################

########
# USAGE
########

# Usage: echo <in_json> | Rscript gdcGRIN2.R

# in_json: [string] input data in JSON format. Streamed through stdin

# Input JSON:
# {
#  genedb: gene db file path
#  chromosomelist={ <key>: <len>, }
#  imagefile: temporary file for generating png figure
#  lesion: flattened string from the output of gdcGRIN2.rs
# }

# Output JSON:
# {
#  png: [<base64 string>]
#  topGeneTable: [<list>]
# }

# supress warnings
options(warn = -1)

suppressPackageStartupMessages({
  library(GRIN2)
  library(DBI)
  library(RSQLite)
  library(dplyr)
  library(base64enc)
  library(jsonlite)
})

### Function to write error messages to stderr
write_error <- function(msg) {
  cat("ERROR: ", msg, "\n", file = stderr())
}

### Function to determine color assignment based on mutation type
#' Assign colors to lesion types based on what's present in the data
#'
#' @param lesion_types A vector of lesion types from your lsn.type column
#' @return A named vector where names are lesion types and values are colors
#'
#' @examples
#' # Example with all three types
#' types1 <- c("mutation", "gain", "loss", "mutation", "gain")
#' colors1 <- assign_lesion_colors(types1)
#'
#' # Example with only two types
#' types2 <- c("gain", "loss", "gain", "loss")
#' colors2 <- assign_lesion_colors(types2)
assign_lesion_colors <- function(lesion_types) {
  # Define color mapping
  color_map <- c(
    "mutation" = "black",
    "gain" = "red",
    "loss" = "blue"
  )

  # Find unique lesion types in your actual data
  unique_types <- unique(lesion_types)

  # Check for any unexpected types
  unknown_types <- setdiff(unique_types, names(color_map))
  if (length(unknown_types) > 0) {
    warning(
      "Unknown lesion types found: ",
      paste(unknown_types, collapse = ", ")
    )
  }

  # Return only the colors for types that exist in your data
  available_colors <- color_map[unique_types]

  # Remove any NA values for unknown types
  available_colors <- available_colors[!is.na(available_colors)]

  # R implicity returns this
  available_colors
}

#' Sort Mutation data based on available p.nsubj columns with priority system
#'
#' @param data Dataframe containing GRIN results (e.g., grin_table)
#' @return Sorted dataframe
#'
#' Priority order:
#' 1. p.nsubj.mutation (highest priority - if available, always use this)
#' 2. p.nsubj.gain (medium priority - use if mutation not available)
#' 3. p.nsubj.loss (lowest priority - use only if neither mutation nor gain available)
sort_grin2_data <- function(data) {
  # Define the possible column names in priority order
  possible_cols <- c("p.nsubj.mutation", "p.nsubj.gain", "p.nsubj.loss")

  # Check if any of our sorting columns exist in the data
  for (col in possible_cols) {
    if (col %in% colnames(data)) {
      sort_column <- col
      break # Stop at first match (highest priority)
    }
  }

  # Perform the sorting
  sorted_data <- data %>%
    arrange(.data[[sort_column]])

  sorted_data
}


### 1. stream in json input data
con <- file("stdin", "r")
json_input <- readLines(con)
close(con)
input <- fromJSON(json_input)

### 2. generate gene annotation table from gene2coord
tryCatch(
  {
    dbfile <- input$genedb
    # connect to SQLite database
    con <- dbConnect(RSQLite::SQLite(), dbname = dbfile)
  },
  error = function(e) {
    write_error(paste(
      "Failed to connect to the gene database:",
      conditionMessage(e)
    ))
    quit(status = 1)
  }
)

## Query the gene2coord table
tryCatch(
  {
    query <- "SELECT name, chr, start, stop FROM gene2coord"
    gene_anno <- dbGetQuery(con, query)
    # Disconnect from the database
    dbDisconnect(con)
  },
  error = function(e) {
    dbDisconnect(con)
    write_error(paste(
      "Failed to query the gene database:",
      conditionMessage(e)
    ))
    quit(status = 1)
  }
)

# Check if dataframe is empty
if (nrow(gene_anno) == 0) {
  write_error("No data retrieved from gene2coord table")
  quit(status = 1)
}

## Remove the problematic header-like row
gene_anno <- gene_anno %>%
  filter(name != "name" | chr != "chr" | start != "start" | stop != "stop")

## Ensure start and stop are integers
tryCatch(
  {
    # Suppress warnings about coercion. We will handle them later.
    invisible(suppressWarnings(
      gene_anno <-
        gene_anno %>%
        mutate(
          start = as.integer(start),
          stop = as.integer(stop),
          chr = ifelse(grepl("^chr", chr), chr, paste0("chr", chr)) # Add "chr" prefix if missing
        )
    ))
  },
  error = function(e) {
    write_error(paste(
      "Failed to convert start/stop to integers:",
      conditionMessage(e)
    ))
    quit(status = 1)
  }
)


## Rename columns to match requested output
gene_anno <- gene_anno %>%
  rename(
    gene.name = name,
    chrom = chr,
    loc.start = start,
    loc.end = stop
  )
## Add gene column
gene_anno$gene <- gene_anno$gene.name

## Add placeholder columns for description, biotype, chrom.strand, and chrom.band
# df <- df %>%
#  mutate(
#    description = NA_character_,
#    gene = NA_character_,
#    biotype = NA_character_,
#    chrom.strand = NA_character_,
#    chrom.band = NA_character_
#  )

## Reorder columns to match requested output
gene_anno <- gene_anno %>%
  select(gene, chrom, loc.start, loc.end)


### 3. generate chromosome size table
# Function to create a sorting key
get_chrom_key <- function(chrom) {
  # Remove 'chr' prefix
  num <- sub("^chr", "", chrom)
  # check if numeric
  if (grepl("^[0-9]+$", num)) {
    as.numeric(num)
  } else {
    # Assign fixed values for non-numeric (X=23, Y=24, others=100)
    ifelse(num == "X", 23, ifelse(num == "Y", 24, 100))
  }
}
tryCatch(
  {
    chromosomelist <- input$chromosomelist
    chrom_size <- data.frame(
      chrom = names(chromosomelist),
      size = as.integer(chromosomelist),
      stringsAsFactors = FALSE
    )
    chrom_size$sort_key <- sapply(chrom_size$chrom, get_chrom_key)
    chrom_size <- chrom_size[order(chrom_size$sort_key), ]
    chrom_size$sort_key <- NULL # Remove the sorting key
  },
  error = function(e) {
    write_error(paste(
      "Failed to read chromosome size file:",
      conditionMessage(e)
    ))
    quit(status = 1)
  }
)

### 4. receive lesion data from node

# Read lesion data from input JSON
tryCatch(
  {
    lesion_data <- input$lesion
    lesion_df <- as.data.frame(lesion_data, stringsAsFactors = FALSE)
    # Assign column names
    colnames(lesion_df) <- c("ID", "chrom", "loc.start", "loc.end", "lsn.type")
    # Ensure correct column types
    lesion_df$ID <- as.character(lesion_df$ID)
    lesion_df$chrom <- as.character(lesion_df$chrom)
    lesion_df$loc.start <- as.integer(lesion_df$loc.start)
    lesion_df$loc.end <- as.integer(lesion_df$loc.end)
    lesion_df$lsn.type <- as.character(lesion_df$lsn.type)

    # Normalize chromosome names - Add "chr" prefix if missing
    lesion_df <- lesion_df %>%
      mutate(
        chrom = ifelse(grepl("^chr", chrom), chrom, paste0("chr", chrom))
      )

    # Get unique lesion types and assign colors for use in plotting later
    lsn_colors <- assign_lesion_colors(lesion_df$lsn.type)
  },
  error = function(e) {
    write_error(paste(
      "Failed to read lesion data from input JSON:",
      conditionMessage(e)
    ))
    quit(status = 1)
  }
)

### 5. run GRIN2 analysis
# Compute grin.stats
tryCatch(
  {
    # More comprehensive suppression of all types of output
    suppressMessages({
      suppressWarnings({
        grin_results <- grin.stats(lesion_df, gene_anno, chrom_size)
      })
    })
    if (is.null(grin_results) || !is.list(grin_results)) {
      write_error("grin.stats returned invalid or null results")
      quit(status = 1)
    }
  },
  error = function(e) {
    write_error(paste("Failed to compute grin.stats:", e$message))
    quit(status = 1)
  }
)

# Extract gene.hits and sort the table by the p-value of subject mutations
tryCatch(
  {
    grin_table <- grin_results$gene.hits
    sorted_results <- sort_grin2_data(grin_table)
  },
  error = function(e) {
    write_error(paste(
      "Failed to extract gene.hits or sort grin_table:",
      e$message
    ))
    quit(status = 1)
  }
)

# Generate genomewide plot and encode PNG as Base64
tryCatch(
  {
    # Temporary file for png figure
    temp_file <- input$imagefile
  },
  error = function(e) {
    write_error(paste(
      "Temporary file for png figure is not provided:",
      e$message
    ))
    quit(status = 1)
  }
)

# Now we can generate the genomewide plot
tryCatch(
  {
    # Create the PNG device
    png(temp_file, width = 900, height = 600, res = 110)
    par(mar = c(1, 1, 1, 1))
    # More comprehensive suppression of all types of output
    suppressMessages({
      suppressWarnings({
        # Main plotting function
        genomewide.lsn.plot(
          grin_results,
          max.log10q = 150,
          lsn.colors = lsn_colors
        )
      })
    })

    # Close the graphics device
    dev.off()

    # Verify the file was created successfully
    if (!file.exists(temp_file)) {
      stop("Plot file was not created")
    }

    if (file.size(temp_file) == 0) {
      stop("Plot file was created but is empty")
    }

    # Read the file and convert to base64
    plot_bytes <- readBin(temp_file, "raw", file.size(temp_file))
    base64_string <- base64enc::base64encode(plot_bytes)

    # Initialize the list
    max_genes_to_show <- 500 # Adjust this number as needed
    num_rows_to_process <- min(nrow(sorted_results), max_genes_to_show)

    topgene_table_data <- list()

    # Convert each row of the dataframe to the format expected by table.ts
    # We only take the top 'num_rows_to_process' rows

    get_sig_values <- function(data) {
      #' Find all existing p-value columns and return corresponding q-value columns
      #'
      #' Since q-values are guaranteed to exist whenever p-values exist,
      #' we only need to check for p-value columns and construct the corresponding
      #' q-value column names.
      #'
      #' @param data A data frame to search for significance columns
      #'
      #' @return A list containing two character vectors:
      #'         - p_cols: Names of all found p-value columns
      #'         - q_cols: Names of corresponding q-value columns
      #'
      #' @examples
      #' result <- get_sig_values(my_data)
      #' p_columns <- result$p_cols
      #' q_columns <- result$q_cols

      # Define all possible column types to check for
      column_types <- c("mutation", "gain", "loss")

      # Get all column names from the dataframe
      available_cols <- colnames(data)

      # Create expected p-value column names
      expected_p_cols <- paste0("p.nsubj.", column_types)
      expected_n_cols <- paste0("nsubj.", column_types)

      # Find which p-value columns actually exist
      existing_p_cols <- expected_p_cols[expected_p_cols %in% available_cols]
      existing_n_cols <- expected_n_cols[expected_n_cols %in% available_cols]

      # Create corresponding q-value column names
      # Simply replace "p.nsubj." with "q.nsubj."
      existing_q_cols <- gsub("^p\\.", "q.", existing_p_cols)

      # Return both vectors
      list(
        p_cols = existing_p_cols,
        q_cols = existing_q_cols,
        n_cols = existing_n_cols
      )
    }

    result <- get_sig_values(sorted_results)
    p_cols <- result$p_cols # All found p-value columns
    q_cols <- result$q_cols # Corresponding q-value columns
    n_cols <- result$n_cols # Corresponding counts columns

    # Function to check if a column has meaningful data
    has_data <- function(column_data, sample_size = 20) {
      # Take a sample of the column (first 20 rows or whatever exists)
      sample_data <- head(column_data, sample_size)

      # Remove NA, NULL, empty strings, and 0 values
      meaningful_data <- sample_data[
        !is.na(sample_data) &
          !is.null(sample_data) &
          sample_data != "" &
          sample_data != 0
      ]

      # Return TRUE if we have any meaningful data
      return(length(meaningful_data) > 0)
    }

    simple_column_filter <- function(sorted_results, num_rows_to_process = 50) {
      # Check which column groups have data (using your existing p_cols, q_cols, n_cols)
      mutation_has_data <- has_data(sorted_results[[p_cols[1]]])
      cnv_gain_has_data <- has_data(sorted_results[[p_cols[2]]])
      cnv_loss_has_data <- has_data(sorted_results[[p_cols[3]]])

      # Build columns list dynamically
      columns <- list(
        list(label = "Gene", sortable = TRUE),
        list(label = "Chromosome", sortable = TRUE)
      )

      # Add mutation columns if they have data
      if (mutation_has_data) {
        columns <- append(
          columns,
          list(
            list(label = "Mutation P-value", sortable = TRUE),
            list(label = "Mutation Q-value", sortable = TRUE),
            list(label = "Mutation Subject Count", sortable = TRUE)
          )
        )
      }

      # Add CNV gain columns if they have data
      if (cnv_gain_has_data) {
        columns <- append(
          columns,
          list(
            list(label = "CNV Gain P-value", sortable = TRUE),
            list(label = "CNV Gain Q-value", sortable = TRUE),
            list(label = "CNV Gain Subject Count", sortable = TRUE)
          )
        )
      }

      # Add CNV loss columns if they have data
      if (cnv_loss_has_data) {
        columns <- append(
          columns,
          list(
            list(label = "CNV Loss P-value", sortable = TRUE),
            list(label = "CNV Loss Q-value", sortable = TRUE),
            list(label = "CNV Loss Subject Count", sortable = TRUE)
          )
        )
      }

      # Build rows to match the active columns
      topgene_table_data <- list()

      for (i in seq_len(min(nrow(sorted_results), num_rows_to_process))) {
        row_data <- list(
          list(value = as.character(sorted_results[i, "gene"])),
          list(value = as.character(sorted_results[i, "chrom"]))
        )

        # Add mutation data if it exists
        if (mutation_has_data) {
          row_data <- append(
            row_data,
            list(
              list(value = as.numeric(sorted_results[i, p_cols[1]])),
              list(value = as.numeric(sorted_results[i, q_cols[1]])),
              list(value = as.numeric(sorted_results[i, n_cols[1]]))
            )
          )
        }

        # Add CNV gain data if it exists
        if (cnv_gain_has_data) {
          row_data <- append(
            row_data,
            list(
              list(value = as.numeric(sorted_results[i, p_cols[2]])),
              list(value = as.numeric(sorted_results[i, q_cols[2]])),
              list(value = as.numeric(sorted_results[i, n_cols[2]]))
            )
          )
        }

        # Add CNV loss data if it exists
        if (cnv_loss_has_data) {
          row_data <- append(
            row_data,
            list(
              list(value = as.numeric(sorted_results[i, p_cols[3]])),
              list(value = as.numeric(sorted_results[i, q_cols[3]])),
              list(value = as.numeric(sorted_results[i, n_cols[3]]))
            )
          )
        }

        topgene_table_data[[i]] <- row_data
      }

      return(list(
        columns = columns,
        rows = topgene_table_data
      ))
    }

    table_result <- simple_column_filter(sorted_results, num_rows_to_process)
    columns <- table_result$columns
    topgene_table_data <- table_result$rows

    grin2_response <- list(
      png = list(base64_string), # PNG data as before
      topGeneTable = list(
        columns = columns, # Use the dynamically generated columns
        rows = topgene_table_data # Use the dynamically generated rows
      ),
      totalGenes = nrow(sorted_results), # Let frontend know total count
      showingTop = num_rows_to_process # Let frontend know how many are displayed
    )

    cat(toJSON(grin2_response))
  },
  error = function(e) {
    # Check if device is still open and close it if needed
    if (dev.cur() > 1) {
      dev.off()
    }

    # Clean up any partial file that might exist
    if (file.exists(temp_file)) {
      unlink(temp_file)
    }

    write_error(paste("Failed to generate genomewide plot:", e$message))
    quit(status = 1)
  },
  warning = function(w) {
    # Capture warnings but continue processing
    write_error(paste("Warning during plot generation:", w$message))
  },
  finally = {
    # Make absolutely sure the device is closed
    if (dev.cur() > 1) {
      dev.off()
    }
  }
)
