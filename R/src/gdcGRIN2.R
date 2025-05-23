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
#  lesion: string from the output of gdcGRIN2.rs
# }

# Output JSON:
# {
#  png: [<base64 string>]
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
  select(gene, chrom, loc.start, loc.end, gene.name)


### 3. generate chromosome size table
# Function to create a sorting key
get_chrom_key <- function(chrom) {
  # Remove 'chr' prefix
  num <- sub("^chr","", chrom)
  # check if numeric
  if (grepl("^[0-9]+$", num)) {
    return(as.numeric(num))
  } else {
    # Assign fixed values for non-numeric (X=23, Y=24, others=100)
    return(ifelse(num == "X", 23, ifelse(num == "Y", 24, 100)))
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
# Initialize an empty dataframe with appropriate columns
lesion_df <- data.frame(
  ID = character(),
  chrom = character(),
  loc.start = integer(),
  loc.end = integer(),
  lsn.type = character(),
  stringsAsFactors = FALSE
)

# Function to process TSV string into dataframe
process_tsv <- function(tsv_string) {
  tryCatch(
    {
      # Clean the TSV string: remove outer quotes and chunk separators
      # tsv_string <- gsub('^"|"$', '', tsv_string)  # Remove leading/trailing quotes
      # tsv_string <- gsub('""', '', tsv_string)  # Remove double quotes between chunks
      # tsv_string <- gsub('^\n|\n$', '', tsv_string) # Remove empty line
      if (nchar(tsv_string) == 0) {
        return(NULL)
      }
      # cat("Raw TSV string:\n",tsv_string,"\n\n")

      # Parse TSV string using textConnection
      temp_df <- read.table(
        text = tsv_string,
        sep = "\t",
        header = FALSE,
        col.names = c("ID", "chrom", "loc.start", "loc.end", "lsn.type"),
        stringsAsFactors = FALSE
      )

      # Ensure correct column types
      temp_df$loc.start <- as.integer(temp_df$loc.start)
      temp_df$loc.end <- as.integer(temp_df$loc.end)
      temp_df$ID <- as.character(temp_df$ID)
      temp_df$chrom <- as.character(temp_df$chrom)
      temp_df$lsn.type <- as.character(temp_df$lsn.type)

      return(temp_df)
    },
    error = function(e) {
      write_error(paste("Error processing mutation data:", conditionMessage(e)))
      NULL
    }
  )
}

# Read all streamed data into a single string
# tryCatch({
#  stream_data <- paste(readLines("stdin"), collapse="\n")
#  },
#  error = function(e){
#    write_error(paste("Failed to read streamed data:", conditionMessage(e)))
#    stop("Stream input error")
#  })
# Read lesion data from input JSON
tryCatch(
  {
    lesion_data <- input$lesion
    lesion_data <- gsub("^\n|\n$", "", lesion_data) # Remove empty line
    lesion_data <- gsub('^"|"$|\\"', "", lesion_data) # Remove leading/trailing quotes
    lesion_data <- gsub("\\\\t", "\t", lesion_data) # Replace escaped tabs with actual tabs
    lesion_data <- gsub("\\\\n", "\n", lesion_data) # Replace escaped newlines with actual newlines
  },
  error = function(e) {
    write_error(paste(
      "Failed to read lesion data from input JSON:",
      conditionMessage(e)
    ))
    quit(status = 1)
  }
)

# Process the TSV
if (nchar(lesion_data) > 0) {
  for (line in strsplit(lesion_data, "\n")[[1]]) {
    temp_df <- process_tsv(line)
    if (!is.null(temp_df)) {
      lesion_df <- rbind(lesion_df, temp_df)
    }
  }
} else {
  write_error("No data received from stream")
  quit(status = 1)
}

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

# Extract gene.hits and sort the table
tryCatch(
  {
    grin_table <- grin_results$gene.hits
    sorted_results <- grin_table[
      order(as.numeric(as.character(grin_table$p2.nsubj))),
    ]
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

tryCatch(
  {
    # Create the PNG device
    #png(temp_file, width = 800, height = 600)
    png(temp_file, width = 900, height = 600, res = 110)
    par(mar = c(1, 1, 1, 1))
    # More comprehensive suppression of all types of output
    suppressMessages({
      suppressWarnings({
        # Main plotting function
        genomewide.lsn.plot(grin_results, max.log10q = 150)
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
    grin2png <- list(png = base64_string)
    cat(toJSON(grin2png))
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
