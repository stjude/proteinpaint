#######################
# Validate R packages #
#######################

# get the path of the directory containing this script
filepath <- gsub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)) # path of this script
dirpath <- dirname(filepath) # path of this directory

# read in the names of the CRAN and Bioconductor dependencies
CRANpkgs <- scan(file = file.path(dirname(dirpath), "cran.pkgs.txt"), what = "character", sep = "\n", quiet = TRUE)
BIOCpkgs <- scan(file = file.path(dirname(dirpath), "bioconductor.pkgs.txt"), what = "character", sep = "\n", quiet = TRUE)
if (length(CRANpkgs) == 0) stop("no cran packages specified")
if (length(BIOCpkgs) == 0) stop("no bioconductor packages specified")
allPkgs <- c(CRANpkgs, BIOCpkgs)

# validate packages by ensuring they load properly
# wrapping in a function to export to other scripts
validatePkgs <- function() {
  for (pkg in allPkgs) {
    suppressPackageStartupMessages(library(pkg, character.only = TRUE))
  }
}

validatePkgs()
