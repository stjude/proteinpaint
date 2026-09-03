export const CATEGORICAL = 'categorical'
export const CONDITION = 'condition'
export const DATE = 'date'
export const DNA_METHYLATION = 'dnaMethylation'
// dt term types, used for filtering variants of a geneVariant term;
// the matching dt term entries are declared in `#shared/common.js` dtTerms[]
export const DTCNV = 'dtcnv'
export const DTFUSION = 'dtfusion'
export const DTITD = 'dtitd'
export const DTSNVINDEL = 'dtsnvindel'
export const DTSV = 'dtsv'
export const FLOAT = 'float'
export const GENE_VARIANT = 'geneVariant'
export const GENE_EXPRESSION = 'geneExpression'
export const ISOFORM_EXPRESSION = 'isoformExpression'
export const INTEGER = 'integer'
export const JUNCTION = 'junction'
export const METABOLITE_INTENSITY = 'metaboliteIntensity'
export const MULTIVALUE = 'multivalue'
export const PROTEOME_ABUNDANCE = 'proteomeAbundance'
export const PROTEOME_DAP = 'proteomeDAP'
export const PSEUDOBULK = 'pseudobulk'
export const SAMPLELST = 'samplelst'
export const SINGLECELL_CELLTYPE = 'singleCellCellType'
export const SINGLECELL_GENE_EXPRESSION = 'singleCellGeneExpression'
export const SINGLECELL_NUMERIC_VALUE = 'singleCellNumericValue'
export const SNP = 'snp'
export const SNP_LIST = 'snplst'
export const SNP_LOCUS = 'snplocus'
export const SSGSEA = 'ssGSEA'
export const SURVIVAL = 'survival'
export const TERM_COLLECTION = 'termCollection'
export const COHORT = 'cohort'

//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == CATEGORICAL instead of type == 'categorical'
// NOTE: keep this list complete at declaration, do not add entries to it at runtime,
// so that consumers see the same keys regardless of module load order
export const TermTypes = {
	GENE_VARIANT,
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	SSGSEA,
	DNA_METHYLATION,
	CATEGORICAL,
	INTEGER,
	JUNCTION,
	FLOAT,
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	CONDITION,
	SURVIVAL,
	SAMPLELST,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	PSEUDOBULK,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	SINGLECELL_NUMERIC_VALUE,
	MULTIVALUE,
	DATE,
	TERM_COLLECTION,
	COHORT,
	DTCNV,
	DTFUSION,
	DTITD,
	DTSNVINDEL,
	DTSV
}
