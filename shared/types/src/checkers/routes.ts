import { createValidate } from 'typia'
import type { GetBrainImagingRequest, GetBrainImagingResponse } from '../routes/brainImaging.ts'
import type { BurdenRequest, BurdenResponse } from '../routes/burden.ts'
import type { DatasetRequest, DatasetResponse } from '../routes/dataset.ts'
import type { DsDataRequest, DsDataResponse } from '../routes/dsdata.ts'
import type { DZImagesRequest, DZImagesResponse } from '../routes/dzimages.ts'
import type { GdcMafRequest, GdcMafResponse } from '../routes/gdc.maf.ts'
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
import type { DERequest, DEResponse } from '../routes/termdb.DE.ts'
import type { BoxPlotRequest, BoxPlotResponse } from '../routes/termdb.boxplot.ts'
import type { CategoriesRequest, CategoriesResponse } from '../routes/termdb.categories.ts'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../routes/termdb.cluster.ts'
import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse } from '../routes/termdb.cohort.summary.ts'
import type { TermdbCohortsRequest, TermdbCohortsResponse } from '../routes/termdb.cohorts.ts'
import type { DescrStatsRequest, DescrStatsResponse } from '../routes/termdb.descrstats.ts'
import type { TermdbGetSampleImagesRequest, TermdbGetSampleImagesResponse } from '../routes/termdb.getSampleImages.ts'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../routes/termdb.getTopTermsByType.ts'
import type {
	getnumericcategoriesRequest,
	getnumericcategoriesResponse
} from '../routes/termdb.getnumericcategories.ts'
import type { getpercentileRequest, getpercentileResponse } from '../routes/termdb.getpercentile.ts'
import type { getroottermRequest, getroottermResponse } from '../routes/termdb.getrootterm.ts'
import type { gettermchildrenRequest, gettermchildrenResponse } from '../routes/termdb.gettermchildren.ts'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../routes/termdb.singleSampleMutation.ts'
import type {
	TermdbSinglecellDEgenesRequest,
	TermdbSinglecellDEgenesResponse
} from '../routes/termdb.singlecellDEgenes.ts'
import type { TermdbSinglecellDataRequest, TermdbSinglecellDataResponse } from '../routes/termdb.singlecellData.ts'
import type {
	TermdbSinglecellsamplesRequest,
	TermdbSinglecellsamplesResponse
} from '../routes/termdb.singlecellSamples.ts'
import type { gettermsbyidsRequest, gettermsbyidsResponse } from '../routes/termdb.termsbyids.ts'
import type {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '../routes/termdb.topVariablyExpressedGenes.ts'
import type { getViolinRequest, getViolinResponse } from '../routes/termdb.violin.ts'
import type { GetWSImagesRequest, GetWSImagesResponse } from '../routes/wsimages.ts'

export const validGetBrainImagingRequest = createValidate<GetBrainImagingRequest>()
export const validGetBrainImagingResponse = createValidate<GetBrainImagingResponse>()
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
export const validTermdbGetSampleImagesRequest = createValidate<TermdbGetSampleImagesRequest>()
export const validTermdbGetSampleImagesResponse = createValidate<TermdbGetSampleImagesResponse>()
export const validTermdbTopTermsByTypeRequest = createValidate<TermdbTopTermsByTypeRequest>()
export const validTermdbTopTermsByTypeResponse = createValidate<TermdbTopTermsByTypeResponse>()
export const validgetnumericcategoriesRequest = createValidate<getnumericcategoriesRequest>()
export const validgetnumericcategoriesResponse = createValidate<getnumericcategoriesResponse>()
export const validgetpercentileRequest = createValidate<getpercentileRequest>()
export const validgetpercentileResponse = createValidate<getpercentileResponse>()
export const validgetroottermRequest = createValidate<getroottermRequest>()
export const validgetroottermResponse = createValidate<getroottermResponse>()
export const validgettermchildrenRequest = createValidate<gettermchildrenRequest>()
export const validgettermchildrenResponse = createValidate<gettermchildrenResponse>()
export const validTermdbSingleSampleMutationRequest = createValidate<TermdbSingleSampleMutationRequest>()
export const validTermdbSingleSampleMutationResponse = createValidate<TermdbSingleSampleMutationResponse>()
export const validTermdbSinglecellDEgenesRequest = createValidate<TermdbSinglecellDEgenesRequest>()
export const validTermdbSinglecellDEgenesResponse = createValidate<TermdbSinglecellDEgenesResponse>()
export const validTermdbSinglecellDataRequest = createValidate<TermdbSinglecellDataRequest>()
export const validTermdbSinglecellDataResponse = createValidate<TermdbSinglecellDataResponse>()
export const validTermdbSinglecellsamplesRequest = createValidate<TermdbSinglecellsamplesRequest>()
export const validTermdbSinglecellsamplesResponse = createValidate<TermdbSinglecellsamplesResponse>()
export const validgettermsbyidsRequest = createValidate<gettermsbyidsRequest>()
export const validgettermsbyidsResponse = createValidate<gettermsbyidsResponse>()
export const validTermdbTopVariablyExpressedGenesRequest = createValidate<TermdbTopVariablyExpressedGenesRequest>()
export const validTermdbTopVariablyExpressedGenesResponse = createValidate<TermdbTopVariablyExpressedGenesResponse>()
export const validgetViolinRequest = createValidate<getViolinRequest>()
export const validgetViolinResponse = createValidate<getViolinResponse>()
export const validGetWSImagesRequest = createValidate<GetWSImagesRequest>()
export const validGetWSImagesResponse = createValidate<GetWSImagesResponse>()
