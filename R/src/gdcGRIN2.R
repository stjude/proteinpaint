suppressPackageStartupMessages({
  library(GRIN2)
  library(DBI)
  library(RSQLite)
  library(dplyr)
  library(base64enc)
})

### Function to write error messages to stderr
write_error <- function(msg) {
  cat("ERROR: ", msg, "\n", file = stderr())
}

### generate gene annotation table from gene2coord
tryCatch({
  # connect to SQLite database
  con <- dbConnect(RSQLite::SQLite(), dbname = "/Users/jwang7/data/tp/anno/genes.hg19.db")
  }, 
  error = function(e){
    write_error(paste("Failed to connect to the gene database:", conditionMessage(e)))
    stop("Database connection error")
  })

## Query the gene2coord table
tryCatch ({
  query <- 'SELECT name, chr, start, stop FROM gene2coord'
  gene.anno <- dbGetQuery(con, query)
  # Disconnect from the database
  dbDisconnect(con)
  },
  error = function(e){
    dbDisconnect(con)
    write_error(paste("Failed to query the gene database:", conditionMessage(e)))
    stop("Database query error")
  })

# Check if dataframe is empty
if (nrow(gene.anno) == 0) {
  write_error("No data retrieved from gene2coord table")
  stop("Empty gene2coord table")
}

## Remove the problematic header-like row
gene.anno <- gene.anno %>%
  filter(name != "name" | chr != "chr" | start != "start" | stop != "stop")

## Ensure start and stop are integers
tryCatch({
  gene.anno <- gene.anno %>%
    mutate(
      start = as.integer(start),
      stop = as.integer(stop),
       chr = ifelse(grepl("^chr", chr), chr, paste0("chr", chr))  # Add "chr" prefix if missing
   )
  },
  error = function(e){
    write_error(paste("Failed to convert start/stop to integers:", conditionMessage(e)))
    stop("Data conversion error")
  })


## Rename columns to match requested output
gene.anno <- gene.anno %>%
  rename(
    gene.name = name,
    chrom = chr,
    loc.start = start,
    loc.end = stop
)
## Add gene column 
gene.anno$gene = gene.anno$gene.name

## Add placeholder columns for description, biotype, chrom.strand, and chrom.band
#df <- df %>%
#  mutate(
#    description = NA_character_,  
#    gene = NA_character_,           
#    biotype = NA_character_,     
#    chrom.strand = NA_character_, 
#    chrom.band = NA_character_   
#  )

## Reorder columns to match requested output
gene.anno <- gene.anno %>%
  select(gene, chrom, loc.start, loc.end, gene.name)


### generate chromosome size table
chrome.size.file <- "/Users/jwang7/data/tp/genomes/hg19.gz.fai"
tryCatch({
  chrome.size <- read.table(
    chrome.size.file,
    sep = "\t",
    header = FALSE,
    stringsAsFactors = FALSE,
    colClasses = c("character", "integer", rep("NULL", 3))
  )
  colnames(chrome.size) <- c("chrom","size")
  chrome.size <- chrome.size[order(chrome.size$chrom),]
  },
  error = function(e){
    write_error(paste("Failed to read chromosome size file:", conditionMessage(e)))
    stop("Chromosome size file error")
  })

### receive lesion data from node 
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
  tryCatch({
    # Clean the TSV string: remove outer quotes and chunk separators
    tsv_string <- gsub('^"|"$', '', tsv_string)  # Remove leading/trailing quotes
    tsv_string <- gsub('""', '', tsv_string)  # Remove double quotes between chunks
    tsv_string <- gsub('^\n|\n$', '', tsv_string) # Remove empty line
    if (nchar(tsv_string) == 0 ){
      return(NULL)
    }
    # cat("Raw TSV string:\n",tsv_string,"\n\n")
    
    # Parse TSV string using textConnection
    temp_df <- read.table(
        text = tsv_string,
        sep = "\t",
        header = FALSE,
        col.names = c("ID","chrom","loc.start","loc.end","lsn.type"),
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
      return(NULL)
    })
}

# Read all streamed data into a single string
tryCatch({
  stream_data <- paste(readLines("stdin"), collapse="\n")
  },
  error = function(e){
    write_error(paste("Failed to read streamed data:", conditionMessage(e)))
    stop("Stream input error")
  })

# Process the TSV
if (nchar(stream_data) > 0) {
  for (line in strsplit(stream_data,"\n")[[1]]) {
    temp_df <- process_tsv(line)
    if (!is.null(temp_df)) {
      lesion_df <- rbind(lesion_df, temp_df)
    }
  }
} else {
  write_error("No data received from stream")
  stop("Empty stream input")
}

### run GRIN2 analysis
# Compute grin.stats
tryCatch({
  grin.results <- grin.stats(lesion_df,
                          gene.anno,
                          chrome.size)
  if (is.null(grin.results) || !is.list(grin.results)) {
    write_error("grin.stats returned invalid or null results")
    quit(status = 1)
    }
  },
  error = function(e) {
    write_error(paste("Failed to compute grin.stats:", e$message))
    quit(status = 1)
  })
# Extract gene.hits and sort the table
tryCatch({
  grin.table <- grin.results$gene.hits
  sorted.results <- grin.table[order(as.numeric(as.character(grin.table$p2.nsubj))),]
  },
  error = function(e) {
    write_error(paste("Failed to extract gene.hits or sort grin.table:", e$message))
    quit(status = 1)
  })

# Generate genomewide plot and encode PNG as Base64
tryCatch({
  genomewide.plot <- genomewide.lsn.plot(grin.results, max.log10q=150)
  png("temp_plot.png",width=800,height=600)
  print(genomewide.plot)
  dev.off()
  base64_string <- base64encode("temp_plot.png")
  },
  error = function(e) {
    write_error(paste("Failed to generate genomewide plot:", e$message))
    quit(status = 1)
  })

print(base64_string)
