#!/usr/bin/python3

"""Convert species name to latin name or database name!
"""

#Current supported species
def SUPSPE():
	return ['human',
		'mouse',
		'zebrafish']

#species info for NCBI *.protein.gpff.gz file downloading
def DOWNAME(n):
	ORG2refDir = {"human":"H_sapiens",
			"mouse":"M_musculus",
			"zebrafish":"D_rerio"}
	if n in ORG2refDir:
		return ORG2refDir[n]
	else:
		return None

#get latin name of species
def GETLATIN(n):
	ORG2LATIN = {"human":"Homo sapiens",
			"mouse":"Mus musculus",
			"zebrafish":"Danio rerio"}
	if n in ORG2LATIN:
		return ORG2LATIN[n]
	else:
		return None

#ensembl dataset name 
def GETDAT(n):
	dataset_name_dic = {"human":"hsapiens_gene_ensembl",
		"zebrafish":"drerio_gene_ensembl",
		"mouse":"mmusculus_gene_ensembl"
		}
	if n in dataset_name_dic:
		return dataset_name_dic[n]
	else:
		return None
