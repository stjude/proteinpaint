#######################
# Validate R packages #
#######################

# get the path of the directory containing this script
filepath <- gsub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)) # path of this script
dirpath <- dirname(filepath) # path of this directory

# read in the lists of CRAN and Bioconductor dependencies
CRANpkgs <- scan(file = file.path(dirpath, "cran.pkgs.txt"), what = "character", sep = "\n", quiet = TRUE)
BIOCpkgs <- scan(file = file.path(dirpath, "bioconductor.pkgs.txt"), what = "character", sep = "\n", quiet = TRUE)
if (length(CRANpkgs) == 0) stop("no cran packages specified")
if (length(BIOCpkgs) == 0) stop("no bioconductor packages specified")
allPkgs <- c(CRANpkgs, BIOCpkgs)

# validate packages by ensuring they load properly
# wrap in a function to export to other scripts
validatePkgs <- function() {
  for (pkg in allPkgs) {
    if (pkg == "BiocManager") {
      # loading BiocManager requires internet connection to reference a remote yaml file (see https://cran.r-project.org/web/packages/BiocManager/vignettes/BiocManager.html#offline-config.yaml)
      # should avoid internet requirement since this script runs upon server startup
      # therefore will skip validation of this package, which is ok since it is
      # only needed to install Bioconductor packages (see "install.pkgs.R") and is
      # not used in runtime
      next
    }
    suppressWarnings({suppressPackageStartupMessages(library(pkg, character.only = TRUE))}) # SuppressWarnings message was added because on addding some other R package (not used by PP) edgeR version was bumped also and started giving warning mesage when this script was run during server startup "package 'edgeR' was built under R version 4.5.1"
  }
}

validatePkgs()
