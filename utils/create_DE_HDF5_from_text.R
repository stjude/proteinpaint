###################
#  INSTRUCTIONS   #
###################
# 1) This R script is not used by PP directly. Its only used to generate HDF5 files for DE analysis
# 2) Installation:
#    a) This package needs the "rhdf5" package. This can be installed by running the following from the R command line: BiocManager::install("rhdf5")
#       Also install "hdf5" tool using the following commands
#       On Mac. $brew install hdf5
#       On linux: $sudo apt-get install -y libhdf5-dev
#    b) Install "readr" package since it handles sample names such as "sample1 ;sample2" better.
# 3) Input file requirements: The columns in text file should be ordered in the following order "geneID\tgeneSymbol\tbioType\tannotationLevel\tSample1\tSample2\tSample3\n"
# 4) Usage: time Rscript create_DE_HDF5_from_text.R {input_text_file} {output_HDF5_file}
# 5) Note: if the output HDF5 file already exists, delete that first before running this R script
# 6) Query output HDF5 files:
#    Each entry (gene_names, gene_symbols, counts, samples) is stored as separate "datasets" inside the HDF5 file.
#    The h5ls command at the bottom of this script outputs the directory structure of the HDF5 file with each of the datasets and its respective dimensions.
#    To query a particular dataset (for e.g. gene_names):
#    $h5dump -d gene_names {output_HDF5_file}

library(rhdf5)
library(readr)
args = commandArgs(trailingOnly=TRUE)

if (length(args) != 2) {
   print ("The R script needs both an input text file and an output HDF5 filename")
   quit(status=1)
}
df <- read_tsv(args[1],col_names=TRUE,show_col_types = FALSE)
gene_names <- df[,1]
gene_symbols <- df[,2]
#print (gene_names)
samples <- colnames(df)
# Removing the first 4 columns from sample names: geneID, geneSymbol, bioType, annotationLevel
samples <- samples[-1]
samples <- samples[-1]
samples <- samples[-1]
samples <- samples[-1]
# Removing the first 4 columns from the dataframe: geneID, geneSymbol, bioType, annotationLevel
df[,1] <- NULL
df[,1] <- NULL
df[,1] <- NULL
df[,1] <- NULL
df <- t(df)
#print (df)

# Define the path to the output HDF5 file
hdf5_file <- args[2]

# Create an HDF5 file
h5createFile(hdf5_file)

# Define the dimensions of the dataset
dims<-dim(df)
#print (dims[2])

# Define the chunk size (one row per chunk)
chunk_size <- c(1, dims[2])

# Create a dataset with sample-wise chunking
print ("Creating counts dataset")
h5createDataset(hdf5_file, "counts", dims = dims, chunk = chunk_size, storage.mode = "double", level = 9) # The chunk_size field option specifies that chunking occurs sample-wise so that all gene counts for a given sample lie inside the same chunk.

# Write the matrix to the HDF5 file
print ("Adding counts to HDF5 file")
h5write(as.matrix(df), hdf5_file, "counts")

# Add dimensions to HDF5 file
print ("Creating dims dataset")
h5createDataset(hdf5_file, "dims", dims = c(2), storage.mode = "integer", level = 9)

# Write the matrix to the HDF5 file
print ("Adding dims to HDF5 file")
h5write(dims, hdf5_file, "dims")

print ("Creating gene_names dataset")
# Add columns to HDF5 file
h5createDataset(hdf5_file, "gene_names", dims = c(length(gene_names$geneID)), storage.mode = "character", level = 9)

print ("Adding gene_names to HDF5 file")
# Write the matrix to the HDF5 file
h5write(gene_names$geneID, hdf5_file, "gene_names")

print ("Creating gene_symbols")
h5createDataset(hdf5_file, "gene_symbols", dims = c(length(gene_symbols$geneSymbol)), storage.mode = "character", level = 9)

print ("Adding gene_symbols to HDF5 file")
# Write the matrix to the HDF5 file
h5write(gene_symbols$geneSymbol, hdf5_file, "gene_symbols")

print ("Creating samples")
# Add samples to HDF5 file
h5createDataset(hdf5_file, "samples", dims = c(length(samples)), storage.mode = "character", level = 9)

print ("Adding samples to HDF5 file")
# Write the matrix to the HDF5 file
# Removing first item in samples list
h5write(as.vector(samples), hdf5_file, "samples")

# Close the HDF5 file
H5close()

# Get directory structure of HDF5
h5ls(hdf5_file)
