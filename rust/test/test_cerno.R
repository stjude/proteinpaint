# This file NOT used directly by PP. This contains the original cerno function in R.
# Utility:
#  1) It contains the test examples being tested by rust/src/test_cerno.rs. The output from this R file is used as the expected output in that file. 
#  2) Function to test and see how CERNO test works inside the tmod package. Both the original CERNO test is available as well as the copied version of the package with all its dependency functions are also available for testing. This is useful because anybody can now add print statements anywhere and examine what each line does in the function. This is how the rust version of CERNO (used by PP) was built.

library(jsonlite)
library(tibble)
library(tmod)

.mset_sanity_check_gs <- function(mset, gs=NULL) {

  required_members <-  c( "gs", "gv", "gs2gv")
  # sanity checks
  if(!all(required_members %in% names(mset))) {
    stop("Required members missing from the list mset parameter")
  }

  if(any(unlist(lapply(required_members, is.null)))) {
    stop("Required members missing from the list mset parameter")
  }

  stopifnot(is(mset$gs, "data.frame"))
  stopifnot("ID" %in% colnames(mset$gs))
  stopifnot(is(mset$gs2gv, "list"))
  
  if(any(duplicated(mset[["gs"]]$ID))) 
    stop("Gene set IDs must not be duplicated")

  stopifnot(length(mset$gs2gv) == nrow(mset$gs)) 

  if(!is.null(gs)) {

    if(!all(gs %in% mset[["gs"]]$ID )) {
      stop("Gene sets specified with the gs parameter are missing from definitions in the mset parameter")
    }
  }

  if(!"tmodGS" %in% class(mset)) {
    class(mset) <- c(class(mset), "tmodGS")
  }

  mset
}

.prep_list <- function(l, mset, x=NULL, nodups=TRUE, filter=FALSE) {

  # prepare the variables specific to that test
  if(nodups) {
    sel <- !duplicated(l)
    l <- l[ sel ]
    if(!is.null(x)) {
      x <- subset(x, sel)
    }
  }

  l_ret <- match(l, mset$gv)

  if(all(is.na(l_ret))) {
    return(NULL)
  }

  ## replace the NAs by not existing indices 
  ## the reason: we want to see that the genes are different
  ## even though they do not correspond to a gene in mset$gv
  .max_n <- length(mset$gv) + 1
  nas <- is.na(l_ret)
  l_ret[ nas ] <- seq(.max_n, length.out=sum(nas))

  # if true, remove the genes absent from mset
  # so basically all for which the returned index is smaller than .max_n
  if(filter) {
    sel <- l_ret < .max_n
    l_ret <- l_ret[ sel ]
    if(!is.null(x)) {
      x <- subset(x, sel)
    }
  }

  if(!is.null(x)) {
    return(list(l=l_ret, x=x))
  }

  l_ret
}


## prepare the modules set
.getmodules_gs <- function(modules=NULL, mset="all", known.only=FALSE, skipcheck=FALSE) {

  if(is(mset, "tmod")) {
    warning(
      "You are loading an obsolete version of tmod R object.
The class `tmod` has been retired.
The data will still work, but it will incur a penalty
on the computational time. Please use the `tmod2tmodGS`
function to convert your object to the new tmodGS class.")
    mset <- tmod2tmodGS(mset)
  }


  # user provided mset
  if(is(mset, "list")) {
    mset <- .mset_sanity_check_gs(mset, modules)
    if(!is.null(modules)) { mset <- mset[ modules ] }
  } else {

    tmod <- .gettmod()
    print ("tmod")
    #print (tmod)


    
    mset <- match.arg(mset, c( "all", unique(tmod$gs$SourceID)))
    if(mset != "all") { 
      if(is.null(modules)) modules <- tmod$gs$ID
      sel <- tmod$gs$SourceID[ match(modules, tmod$gs$ID) ] == mset
      modules <- modules[ sel ]
    }

    if(!is.null(modules)) {
      modules <- modules[ modules %in% tmod$gs$ID ]
      mset <- tmod[ modules ]
    } else {
      mset <- tmod
    }
  }


  if(known.only && "Title" %in% colnames(mset$gs)) {
    mset <- mset[ ! is.na(mset$gs$Title) & ! mset$gs$Title %in% c( "TBA", "Undetermined", ""), ]
  }

  mset
}

.tmodTest <- function(mod.test, post.test=NULL, qval= 0.05, order.by= "pval", mset=NULL, 
                      cols=c("ID", "Description", "Title")) {
  if(is.null(mset)) stop("Something went wrong in .tmodTest")
  gs_ids <- mset$gs$ID

  order.by <- match.arg(order.by, c("pval", "none", "auc"))

  # --------------------------------------------------------------
  #                  The actual test
  ret <- lapply(1:length(gs_ids), mod.test)
  ret <- tibble(as.data.frame(Reduce(rbind, ret)))
  if(!is.null(post.test)) ret <- post.test(ret)
  # --------------------------------------------------------------
  print ("After test:")
  print (ret)

  cols <- intersect(c("ID", cols), colnames(mset$gs))
  ret2 <- tibble(mset$gs[ ret$n_id, cols, drop=FALSE ])

  ret <- cbind(ret2, ret)
  ret$n_id <- NULL

  ret$adj.P.Val <- p.adjust(ret$P.Value, method= "fdr")
  rownames(ret) <- ret$ID
  ret <- ret[ ret$adj.P.Val < qval,, drop= FALSE ]

  if(order.by == "pval") ret <- ret[ order(ret$P.Value), ]
  if(order.by == "auc")  ret <- ret[ order(ret$AUC), ]
  class(ret) <- c("tmodReport", "colorDF", class(ret))

  # set colorDF column type
  #col_type(ret, "P.Value")   <- "pval"
  #col_type(ret, "adj.P.Val") <- "pval"

  ret

}

tmodCERNOtest_local <- function(l, modules=NULL, qval= 0.05, order.by= "pval", filter= FALSE, mset="all", 
                                cols="Title", nodups=TRUE) {

  # process mset parameter
  mset <- .getmodules_gs(modules, mset)
  print ("mset")
  print (mset)
  
  l <- .prep_list(l, mset, nodups=nodups, filter=filter)

  if(is.null(l)) {
    warning( "No genes in l match genes in GENES" )
  }

  #print ("L:")
  #print (l)
  N <- length(l)
  #print ("N:")
  #print (N)
  
  # set up the test function
  mod.test <- function(m) {
    #print (paste0(c("m:",m)))
    x <- l %in% mset$gs2gv[[m]]
    #print (paste0(c("x:",x)))
    N1 <- sum(x)
    #print (paste0(c("N1:",N1)))
    
    ranks <- c(1:N)[x]
    #print ("ranks:")
    #print (ranks)
    cerno <- -2 * sum( log(ranks/N) )
    cES <- cerno/(2*N1)
    ret <- c(n_id=m, cerno=cerno, N1=N1, R1=sum(ranks), cES=cES, P.Value=1)
    ret
  }

  post.test <- function(ret) {
    ret <- data.frame(ret, stringsAsFactors=FALSE)
    N1 <- ret$N1
    N2 <- N - N1
    R1 <- ret$R1
    #print (paste0(c("N1:",N1)))
    U  <- N1*N2+N1*(N1+1)/2-R1
    #print (paste0(c("U:",U)))
    ret$AUC <- U/(N1*N2)
    ret <- ret[ , c("n_id", "cerno", "N1", "AUC", "cES" ) ]
    ret$P.Value= pchisq(ret$cerno, 2*ret$N1, lower.tail=FALSE)
    ret
  }

  ret <- .tmodTest(mod.test, post.test, qval=qval, order.by=order.by, mset=mset, cols=cols)
  attr(ret, "effect_size") <- "AUC"
  attr(ret, "pvalue")      <- "adj.P.Val"
  ret
}
# Input data from cerno_test.json
input<-fromJSON(gzfile("cerno_test.json.gz"))

gs2gv <- list()
for (i in 1:length(input$MODULES2GENES)) {
  common_genes <- intersect(input$MODULES2GENES[[i]], input$GENES)
  common_positions <- which(input$GENES %in% common_genes)
  gs2gv[[i]] <- common_positions
}  

#print (gs2gv)

hallmark <- list(
  gs = as_tibble(input$MODULES),
  gs2gv = gs2gv,
  gv = input$GENES
)

#print ("hallmark")
#print (hallmark)

genes_df <- data.frame(genes = input$input_genes, fold_change = input$input_fold_change)
genes_df <- genes_df[order(genes_df$fold_change, decreasing = TRUE), ] # Sorting the genes in decreasing order of fold-change

#print (genes_df)
DE_genes <- genes_df$genes
#print ("DE_genes")
#print (DE_genes)

result_local <- tmodCERNOtest_local(DE_genes,mset = hallmark, qval = 1.0)
print ("result_local decreasing")
print (result_local)

result <- tmodCERNOtest(DE_genes,mset = hallmark, qval = 1.0)
print ("result decreasing")
print (result)


genes_df <- genes_df[order(genes_df$fold_change, decreasing = FALSE), ] # Sorting the genes in decreasing order of fold-change

#print (genes_df)
DE_genes <- genes_df$genes
#print ("DE_genes")
#print (DE_genes)

result_local <- tmodCERNOtest_local(DE_genes,mset = hallmark, qval = 1.0)
print ("result_local ascending")
print (result_local)

result <- tmodCERNOtest(DE_genes,mset = hallmark, qval = 1.0)
print ("result ascending")
print (result)
