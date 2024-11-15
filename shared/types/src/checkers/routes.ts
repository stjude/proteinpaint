import { createValidate } from 'typia'
import type { BrainImagingRequest, BrainImagingResponse } from '../routes/brainImaging.ts'
import type { BrainImagingSamplesRequest, BrainImagingSamplesResponse } from '../routes/brainImagingSamples.ts'
import type { BurdenRequest, BurdenResponse } from '../routes/burden.ts'
import type { DatasetRequest, DatasetResponse } from '../routes/dataset.ts'
import type { DsDataRequest, DsDataResponse } from '../routes/dsdata.ts'
import type { DZImagesRequest, DZImagesResponse } from '../routes/dzimages.ts'
import type { GdcMafRequest, GdcMafResponse } from '../routes/gdc.maf.ts'
import type { GdcMafBuildRequest, GdcMafBuildResponse } from '../routes/gdc.mafBuild.ts'
import type { GdcTopMutatedGeneRequest, GdcTopMutatedGeneResponse } from '../routes/gdc.topMutatedGenes.ts'
import type { GeneLookupRequest, GeneLookupResponse } from '../routes/genelookup.ts'
import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse } from '../routes/genesetEnrichment.ts'
import type {
	GenesetOverrepresentationRequest,
	GenesetOverrepresentationResponse
} from '../routes/genesetOverrepresentation.ts'
import type { HealthCheckRequest, HealthCheckResponse } from '../routes/healthcheck.ts'
import type { HicdataRequest, HicdataResponse } from '../routes/hicdata.ts'
import type { HicGenomeRequest, HicGenomeResponse } from '../routes/hicgenome.ts'
import type { HicstatRequest, HicstatResponse } from '../routes/hicstat.ts'
import type { IsoformLstRequest, IsoformLstResponse } from '../routes/isoformlst.ts'
import type { NtseqRequest, NtseqResponse } from '../routes/ntseq.ts'
import type { PdomainRequest, PdomainResponse } from '../routes/pdomain.ts'
import type { SampleWSImagesRequest, SampleWSImagesResponse } from '../routes/samplewsimages.ts'
import type { SnpRequest, SnpResponse } from '../routes/snp.ts'
import type { BoxPlotRequest, BoxPlotResponse } from '../routes/termdb.boxplot.ts'
import type { CategoriesRequest, CategoriesResponse } from '../routes/termdb.categories.ts'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../routes/termdb.cluster.ts'
import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse } from '../routes/termdb.cohort.summary.ts'
import type { TermdbCohortsRequest, TermdbCohortsResponse } from '../routes/termdb.cohorts.ts'
import type { DERequest, DEResponse } from '../routes/termdb.DE.ts'
import type { DescrStatsRequest, DescrStatsResponse } from '../routes/termdb.descrstats.ts'
import type { NumericCategoriesRequest, NumericCategoriesResponse } from '../routes/termdb.numericcategories.ts'
import type { PercentileRequest, PercentileResponse } from '../routes/termdb.percentile.ts'
import type { RootTermRequest, RootTermResponse } from '../routes/termdb.rootterm.ts'
import type { TermdbSampleImagesRequest, TermdbSampleImagesResponse } from '../routes/termdb.sampleImages.ts'
import type { TermdbSingleCellDataRequest, TermdbSingleCellDataResponse } from '../routes/termdb.singlecellData.ts'
import type {
	TermdbSingleCellDEgenesRequest,
	TermdbSingleCellDEgenesResponse
} from '../routes/termdb.singlecellDEgenes.ts'
import type {
	TermdbSingleCellSamplesRequest,
	TermdbSingleCellSamplesResponse
} from '../routes/termdb.singlecellSamples.ts'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../routes/termdb.singleSampleMutation.ts'
import type { TermChildrenRequest, TermChildrenResponse } from '../routes/termdb.termchildren.ts'
import type { TermsByIdsRequest, TermsByIdsResponse } from '../routes/termdb.termsbyids.ts'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../routes/termdb.topTermsByType.ts'
import type {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '../routes/termdb.topVariablyExpressedGenes.ts'
import type { ViolinRequest, ViolinResponse } from '../routes/termdb.violin.ts'
import type { TileRequest, TileResponse } from '../routes/tileserver.ts'
import type { WSImagesRequest, WSImagesResponse } from '../routes/wsimages.ts'

export { brainImagingPayload } from '../routes/brainImaging.ts'
export { brainImagingSamplesPayload } from '../routes/brainImagingSamples.ts'
export { burdenPayload } from '../routes/burden.ts'
export { datasetPayload } from '../routes/dataset.ts'
export { dsDataPayload } from '../routes/dsdata.ts'
export { dzImagesPayload } from '../routes/dzimages.ts'
export { gdcMafPayload } from '../routes/gdc.maf.ts'
export { GdcMafPayload } from '../routes/gdc.mafBuild.ts'
export { gdcTopMutatedGenePayload } from '../routes/gdc.topMutatedGenes.ts'
export { geneLookupPayload } from '../routes/genelookup.ts'
export { genesetEnrichmentPayload } from '../routes/genesetEnrichment.ts'
export { genesetOverrepresentationPayload } from '../routes/genesetOverrepresentation.ts'
export { healthcheckPayload } from '../routes/healthcheck.ts'
export { hicdataPayload } from '../routes/hicdata.ts'
export { hicGenomePayload } from '../routes/hicgenome.ts'
export { hicstatPayload } from '../routes/hicstat.ts'
export { isoformlstPayload } from '../routes/isoformlst.ts'
export { ntseqPayload } from '../routes/ntseq.ts'
export { pdomainPayload } from '../routes/pdomain.ts'
export { sampleWSImagesPayload } from '../routes/samplewsimages.ts'
export { snpPayload } from '../routes/snp.ts'
export { boxplotPayload } from '../routes/termdb.boxplot.ts'
export { termdbCategoriesPayload } from '../routes/termdb.categories.ts'
export { termdbClusterPayload } from '../routes/termdb.cluster.ts'
export { termdbCohortSummaryPayload } from '../routes/termdb.cohort.summary.ts'
export { termdbCohortsPayload } from '../routes/termdb.cohorts.ts'
export { diffExpPayload } from '../routes/termdb.DE.ts'
export { descrStatsPayload } from '../routes/termdb.descrstats.ts'
export { numericCategoriesPayload } from '../routes/termdb.numericcategories.ts'
export { percentilePayload } from '../routes/termdb.percentile.ts'
export { rootTermPayload } from '../routes/termdb.rootterm.ts'
export { termdbSampleImagesPayload } from '../routes/termdb.sampleImages.ts'
export { termdbSingleCellDataPayload } from '../routes/termdb.singlecellData.ts'
export { termdbSingleCellDEgenesPayload } from '../routes/termdb.singlecellDEgenes.ts'
export { termdbSingleCellSamplesPayload } from '../routes/termdb.singlecellSamples.ts'
export { termdbSingleSampleMutationPayload } from '../routes/termdb.singleSampleMutation.ts'
export { termChildrenPayload } from '../routes/termdb.termchildren.ts'
export { termsByIdsPayload } from '../routes/termdb.termsbyids.ts'
export { termdbTopTermsByTypePayload } from '../routes/termdb.topTermsByType.ts'
export { termdbTopVariablyExpressedGenesPayload } from '../routes/termdb.topVariablyExpressedGenes.ts'
export { violinPayload } from '../routes/termdb.violin.ts'
export { tilePayload } from '../routes/tileserver.ts'
export { wsImagesPayload } from '../routes/wsimages.ts'

export const validBrainImagingRequest = createValidate<BrainImagingRequest>()
export const validBrainImagingResponse = createValidate<BrainImagingResponse>()
export const validBrainImagingSamplesRequest = createValidate<BrainImagingSamplesRequest>()
export const validBrainImagingSamplesResponse = createValidate<BrainImagingSamplesResponse>()
export const validBurdenRequest = createValidate<BurdenRequest>()
export const validBurdenResponse = createValidate<BurdenResponse>()
export const validDatasetRequest = createValidate<DatasetRequest>()
export const validDatasetResponse = createValidate<DatasetResponse>()
export const validDsDataRequest = createValidate<DsDataRequest>()
export const validDsDataResponse = createValidate<DsDataResponse>()
export const validDZImagesRequest = createValidate<DZImagesRequest>()
export const validDZImagesResponse = createValidate<DZImagesResponse>()
export const validGdcMafRequest = createValidate<GdcMafRequest>()
export const validGdcMafResponse = createValidate<GdcMafResponse>()
export const validGdcMafBuildRequest = createValidate<GdcMafBuildRequest>()
export const validGdcMafBuildResponse = createValidate<GdcMafBuildResponse>()
export const validGdcTopMutatedGeneRequest = createValidate<GdcTopMutatedGeneRequest>()
export const validGdcTopMutatedGeneResponse = createValidate<GdcTopMutatedGeneResponse>()
export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
export const validGenesetEnrichmentRequest = createValidate<GenesetEnrichmentRequest>()
export const validGenesetEnrichmentResponse = createValidate<GenesetEnrichmentResponse>()
export const validGenesetOverrepresentationRequest = createValidate<GenesetOverrepresentationRequest>()
export const validGenesetOverrepresentationResponse = createValidate<GenesetOverrepresentationResponse>()
export const validHealthCheckRequest = createValidate<HealthCheckRequest>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
export const validHicdataRequest = createValidate<HicdataRequest>()
export const validHicdataResponse = createValidate<HicdataResponse>()
export const validHicGenomeRequest = createValidate<HicGenomeRequest>()
export const validHicGenomeResponse = createValidate<HicGenomeResponse>()
export const validHicstatRequest = createValidate<HicstatRequest>()
export const validHicstatResponse = createValidate<HicstatResponse>()
export const validIsoformLstRequest = createValidate<IsoformLstRequest>()
export const validIsoformLstResponse = createValidate<IsoformLstResponse>()
export const validNtseqRequest = createValidate<NtseqRequest>()
export const validNtseqResponse = createValidate<NtseqResponse>()
export const validPdomainRequest = createValidate<PdomainRequest>()
export const validPdomainResponse = createValidate<PdomainResponse>()
export const validSampleWSImagesRequest = createValidate<SampleWSImagesRequest>()
export const validSampleWSImagesResponse = createValidate<SampleWSImagesResponse>()
export const validSnpRequest = createValidate<SnpRequest>()
export const validSnpResponse = createValidate<SnpResponse>()
export const validBoxPlotRequest = createValidate<BoxPlotRequest>()
export const validBoxPlotResponse = createValidate<BoxPlotResponse>()
export const validCategoriesRequest = createValidate<CategoriesRequest>()
export const validCategoriesResponse = createValidate<CategoriesResponse>()
export const validTermdbClusterRequest = createValidate<TermdbClusterRequest>()
export const validTermdbClusterResponse = createValidate<TermdbClusterResponse>()
export const validTermdbCohortSummaryRequest = createValidate<TermdbCohortSummaryRequest>()
export const validTermdbCohortSummaryResponse = createValidate<TermdbCohortSummaryResponse>()
export const validTermdbCohortsRequest = createValidate<TermdbCohortsRequest>()
export const validTermdbCohortsResponse = createValidate<TermdbCohortsResponse>()
export const validDERequest = createValidate<DERequest>()
export const validDEResponse = createValidate<DEResponse>()
export const validDescrStatsRequest = createValidate<DescrStatsRequest>()
export const validDescrStatsResponse = createValidate<DescrStatsResponse>()
export const validNumericCategoriesRequest = createValidate<NumericCategoriesRequest>()
export const validNumericCategoriesResponse = createValidate<NumericCategoriesResponse>()
export const validPercentileRequest = createValidate<PercentileRequest>()
export const validPercentileResponse = createValidate<PercentileResponse>()
export const validRootTermRequest = createValidate<RootTermRequest>()
export const validRootTermResponse = createValidate<RootTermResponse>()
export const validTermdbSampleImagesRequest = createValidate<TermdbSampleImagesRequest>()
export const validTermdbSampleImagesResponse = createValidate<TermdbSampleImagesResponse>()
export const validTermdbSingleCellDataRequest = createValidate<TermdbSingleCellDataRequest>()
export const validTermdbSingleCellDataResponse = createValidate<TermdbSingleCellDataResponse>()
export const validTermdbSingleCellDEgenesRequest = createValidate<TermdbSingleCellDEgenesRequest>()
export const validTermdbSingleCellDEgenesResponse = createValidate<TermdbSingleCellDEgenesResponse>()
export const validTermdbSingleCellSamplesRequest = createValidate<TermdbSingleCellSamplesRequest>()
export const validTermdbSingleCellSamplesResponse = createValidate<TermdbSingleCellSamplesResponse>()
export const validTermdbSingleSampleMutationRequest = createValidate<TermdbSingleSampleMutationRequest>()
export const validTermdbSingleSampleMutationResponse = createValidate<TermdbSingleSampleMutationResponse>()
export const validTermChildrenRequest = createValidate<TermChildrenRequest>()
export const validTermChildrenResponse = createValidate<TermChildrenResponse>()
export const validTermsByIdsRequest = createValidate<TermsByIdsRequest>()
export const validTermsByIdsResponse = createValidate<TermsByIdsResponse>()
export const validTermdbTopTermsByTypeRequest = createValidate<TermdbTopTermsByTypeRequest>()
export const validTermdbTopTermsByTypeResponse = createValidate<TermdbTopTermsByTypeResponse>()
export const validTermdbTopVariablyExpressedGenesRequest = createValidate<TermdbTopVariablyExpressedGenesRequest>()
export const validTermdbTopVariablyExpressedGenesResponse = createValidate<TermdbTopVariablyExpressedGenesResponse>()
export const validViolinRequest = createValidate<ViolinRequest>()
export const validViolinResponse = createValidate<ViolinResponse>()
export const validTileRequest = createValidate<TileRequest>()
export const validTileResponse = createValidate<TileResponse>()
export const validWSImagesRequest = createValidate<WSImagesRequest>()
export const validWSImagesResponse = createValidate<WSImagesResponse>()
