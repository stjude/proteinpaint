######################
# Install R packages #
######################

# This script will update and install R packages used by the R source code.

# It is important to update installed packages before installing new packages
# to ensure that newly installed packages will use up-to-date dependencies.

# get the path of the directory containing this script
filepath <- gsub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)) # path of this script
dirpath <- dirname(filepath) # path of this directory

# read in the lists of CRAN packages and Bioconductor packages to install
CRANpkgs <- scan(file = file.path(dirpath, "cran.pkgs.txt"), what = "character", sep = "\n", quiet = TRUE)
BIOCpkgs <- scan(file = file.path(dirpath, "bioconductor.pkgs.txt"), what = "character", sep = "\n", quiet = TRUE)
if (length(CRANpkgs) == 0) stop("no cran packages specified")
if (length(BIOCpkgs) == 0) stop("no bioconductor packages specified")

repo <- "https://cloud.r-project.org"

# update and install CRAN packages
cat("\nUPDATING CRAN PACKAGES...\n\n")
update.packages(repos = repo, ask = FALSE)
cat("\nINSTALLING CRAN PACKAGES...\n\n")
for (pkg in CRANpkgs) {
  if (!(pkg %in% installed.packages()[,"Package"])) {
    # package not installed, so install it
    install.packages(pkg, repos = repo)
  }
}

# update and install Bioconductor packages
cat("\nUPDATING BIOCONDUCTOR PACKAGES...\n\n")
BiocManager::install(ask = FALSE)
cat("\nINSTALLING BIOCONDUCTOR PACKAGES...\n\n")
for (pkg in BIOCpkgs) {
  if (!(pkg %in% installed.packages()[,"Package"])) {
    # package not installed, so install it
    BiocManager::install(pkg, ask = FALSE)
  }
}

# validate packages
source(file.path(dirpath, "validate.pkgs.R"))
cat("\nVALIDATING PACKAGES...\n\n")
validatePkgs()
