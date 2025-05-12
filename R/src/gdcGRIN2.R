suppressPackageStartupMessages({
  library(GRIN2)
  library(DBI)
  library(RSQLite)
  library(dplyr)
})

### generate gene annotation table from gene2coord
## connect to SQLite database
con <- dbConnect(RSQLite::SQLite(), dbname = "/Users/jwang7/data/tp/anno/genes.hg19.db")

## Query the gene2coord table
query <- 'SELECT name, chr, start, stop FROM gene2coord'
df <- dbGetQuery(con, query)

## Disconnect from the database
dbDisconnect(con)

## Remove the problematic header-like row
df <- df %>%
  filter(name != "name" | chr != "chr" | start != "start" | stop != "stop")

## Ensure start and stop are integers
df <- df %>%
  mutate(
    start = as.integer(start),
    stop = as.integer(stop),
    chr = ifelse(grepl("^chr", chr), chr, paste0("chr", chr))  # Add "chr" prefix if missing
  )

## Rename columns to match requested output
df <- df %>%
  rename(
    gene.name = name,
    chrom = chr,
    loc.start = start,
    loc.end = stop
  )
## Add placeholder columns for description, biotype, chrom.strand, and chrom.band
df <- df %>%
  mutate(
    description = NA_character_,  
    gene = NA_character_,           
    biotype = NA_character_,     
    chrom.strand = NA_character_, 
    chrom.band = NA_character_   
  )

## Reorder columns to match requested output
df <- df %>%
  select(gene, chrom, loc.start, loc.end, description, gene.name, biotype, chrom.strand, chrom.band)


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
    cat("Raw TSV string:\n",tsv_string,"\n\n")
    
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
    }, error = function(e) {
      warning("Error processing TSV data: ", conditionMessage(e))
      return(NULL)
    })
}

# Read all streamed data into a single string
stream_data <- paste(readLines("stdin"), collapse="\n")
print("stream_data")
print(stream_data)

# Process the TSV
if (nchar(stream_data) > 0) {
  for (line in strsplit(stream_data,"\n")[[1]]) {
    print(line)
    temp_df <- process_tsv(line)
    if (!is.null(temp_df)) {
      lesion_df <- rbind(lesion_df, temp_df)
    }
  }
} else {
  message("No data received from stream")
}

# View the resulting dataframe
print(lesion_df)
