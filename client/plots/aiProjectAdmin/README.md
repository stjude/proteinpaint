_This document is a draft_

# AI Project Admin
This plot supports training AI models. This is a MVP. 

First, a UI to create and manage new projects is rendered. In the create project UI, users apply a filter and classes (eventually users) and then select the data to annotate. 


# Code architecture
## Plot
//TODO: add documenation about plot architecture

## Data 
The data for this plot is intended in two structures: 
1. A writable db for persisting project details and;  
2. An ad hoc dictionary that creates term objects on the fly from .csv/.tsv metadata files. 

Querying and writing to the db is handled in the 'aiProjectAdmin' route. Ad hoc methods attached to ds.cohort.termdb.q{} retrieve information from the ad hoc dictionary. See code in TermdbVocab and buildAhHocDictionary. 