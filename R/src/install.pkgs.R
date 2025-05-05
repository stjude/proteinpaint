######################
# Install R packages #
######################

# This script will update and install R packages used by the R source code.

# It is important to update installed packages before installing new packages
# to ensure that newly installed packages will use up-to-date dependencies.

# CRAN packages to install. Add any new packages to this vector.
CRANpkgs <- c("cmprsk", "jsonlite", "survival", "lmtest", "dplyr", "tidyr", "BiocManager", "readr", "doParallel", "ggplot2")
# Bioconductor packages to install. Add any new packages to this vector.
BIOCpkgs <- c("edgeR", "rhdf5")

repo <- "https://cran.rstudio.com"

## CRAN packages
# update installed packages
cat("\nUPDATING CRAN PACKAGES...\n\n")
update.packages(repos = repo, ask = FALSE)
# install new packages
cat("\nINSTALLING CRAN PACKAGES...\n\n")
for (pkg in CRANpkgs) {
  if (!(pkg %in% installed.packages()[,"Package"])) {
    # package not installed, so install it
    install.packages(pkg, repos = repo)
  }
}

## Bioconductor packages
# update installed packages
cat("\nUPDATING BIOCONDUCTOR PACKAGES...\n\n")
BiocManager::install(ask = FALSE)
# install new packages
cat("\nINSTALLING BIOCONDUCTOR PACKAGES...\n\n")
for (pkg in BIOCpkgs) {
  if (!(pkg %in% installed.packages()[,"Package"])) {
    # package not installed, so install it
    BiocManager::install(pkg, ask = FALSE)
  }
}
