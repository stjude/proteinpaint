import { createValidate } from 'typia'
import type { BrainImagingRequest, BrainImagingResponse } from '../routes/brainImaging.js'
import type { BurdenRequest, BurdenResponse } from '../routes/burden.js'
import type { DatasetRequest, DatasetResponse } from '../routes/dataset.js'
import type { DsDataRequest, DsDataResponse } from '../routes/dsdata.js'
import type { DZImagesRequest, DZImagesResponse } from '../routes/dzimages.js'
import type { GdcMafRequest, GdcMafResponse } from '../routes/gdc.maf.js'
import type { GdcTopMutatedGeneRequest, GdcTopMutatedGeneResponse } from '../routes/gdc.topMutatedGenes.js'
import type { GeneLookupRequest, GeneLookupResponse } from '../routes/genelookup.js'
import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse } from '../routes/genesetEnrichment.js'
import type {
	GenesetOverrepresentationRequest,
	GenesetOverrepresentationResponse
} from '../routes/genesetOverrepresentation.js'
import type { HealthCheckRequest, HealthCheckResponse } from '../routes/healthcheck.js'
import type { HicdataRequest, HicdataResponse } from '../routes/hicdata.js'
import type { HicGenomeRequest, HicGenomeResponse } from '../routes/hicgenome.js'
import type { HicstatRequest, HicstatResponse } from '../routes/hicstat.js'
import type { IsoformLstRequest, IsoformLstResponse } from '../routes/isoformlst.js'
import type { NtseqRequest, NtseqResponse } from '../routes/ntseq.js'
import type { PdomainRequest, PdomainResponse } from '../routes/pdomain.js'
import type { SampleWSImagesRequest, SampleWSImagesResponse } from '../routes/samplewsimages.js'
import type { DERequest, DEResponse } from '../routes/termdb.DE.js'
import type { BoxPlotRequest, BoxPlotResponse } from '../routes/termdb.boxplot.js'
import type { CategoriesRequest, CategoriesResponse } from '../routes/termdb.categories.js'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../routes/termdb.cluster.js'
import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse } from '../routes/termdb.cohort.summary.js'
import type { TermdbCohortsRequest, TermdbCohortsResponse } from '../routes/termdb.cohorts.js'
import type { DescrStatsRequest, DescrStatsResponse } from '../routes/termdb.descrstats.js'
import type { NumericCategoriesRequest, NumericCategoriesResponse } from '../routes/termdb.numericcategories.js'
import type { PercentileRequest, PercentileResponse } from '../routes/termdb.percentile.js'
import type { RootTermRequest, RootTermResponse } from '../routes/termdb.rootterm.js'
import type { TermdbSampleImagesRequest, TermdbSampleImagesResponse } from '../routes/termdb.sampleImages.js'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../routes/termdb.singleSampleMutation.js'
import type {
	TermdbSingleCellDEgenesRequest,
	TermdbSingleCellDEgenesResponse
} from '../routes/termdb.singlecellDEgenes.js'
import type { TermdbSingleCellDataRequest, TermdbSingleCellDataResponse } from '../routes/termdb.singlecellData.js'
import type {
	TermdbSingleCellSamplesRequest,
	TermdbSingleCellSamplesResponse
} from '../routes/termdb.singlecellSamples.js'
import type { TermChildrenRequest, TermChildrenResponse } from '../routes/termdb.termchildren.js'
import type { TermsByIdsRequest, TermsByIdsResponse } from '../routes/termdb.termsbyids.js'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../routes/termdb.topTermsByType.js'
import type {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '../routes/termdb.topVariablyExpressedGenes.js'
import type { ViolinRequest, ViolinResponse } from '../routes/termdb.violin.js'
import type { TileRequest, TileResponse } from '../routes/tileserver.js'
import type { WSImagesRequest, WSImagesResponse } from '../routes/wsimages.js'

export const validBrainImagingRequest = createValidate<BrainImagingRequest>()
export const validBrainImagingResponse = createValidate<BrainImagingResponse>()
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
export const validDERequest = createValidate<DERequest>()
export const validDEResponse = createValidate<DEResponse>()
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
export const validTermdbSingleSampleMutationRequest = createValidate<TermdbSingleSampleMutationRequest>()
export const validTermdbSingleSampleMutationResponse = createValidate<TermdbSingleSampleMutationResponse>()
export const validTermdbSingleCellDEgenesRequest = createValidate<TermdbSingleCellDEgenesRequest>()
export const validTermdbSingleCellDEgenesResponse = createValidate<TermdbSingleCellDEgenesResponse>()
export const validTermdbSingleCellDataRequest = createValidate<TermdbSingleCellDataRequest>()
export const validTermdbSingleCellDataResponse = createValidate<TermdbSingleCellDataResponse>()
export const validTermdbSingleCellSamplesRequest = createValidate<TermdbSingleCellSamplesRequest>()
export const validTermdbSingleCellSamplesResponse = createValidate<TermdbSingleCellSamplesResponse>()
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
