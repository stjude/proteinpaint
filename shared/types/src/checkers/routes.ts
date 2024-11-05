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
import type { HealthCheckResponse } from '../routes/healthcheck.ts'
import type { HicdataRequest, HicdataResponse } from '../routes/hicdata.ts'
import type { HicGenomeRequest, HicGenomeResponse } from '../routes/hicgenome.ts'
import type { HicstatRequest, HicstatResponse } from '../routes/hicstat.ts'
import type { GetSampleWSImagesRequest, GetSampleWSImagesResponse } from '../routes/samplewsimages.ts'
import type { DERequest, DEResponse } from '../routes/termdb.DE.ts'
import type { BoxPlotRequest, BoxPlotResponse } from '../routes/termdb.boxplot.ts'
import type { getcategoriesRequest, getcategoriesResponse } from '../routes/termdb.categories.ts'
import type { TermdbClusterRequest, TermdbClusterResponse } from '../routes/termdb.cluster.ts'
import type { TermdbGetSampleImagesRequest, TermdbGetSampleImagesResponse } from '../routes/termdb.getSampleImages.ts'
import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../routes/termdb.getTopTermsByType.ts'
import type { getdescrstatsRequest, getdescrstatsResponse } from '../routes/termdb.getdescrstats.ts'
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
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
export const validHicdataRequest = createValidate<HicdataRequest>()
export const validHicdataResponse = createValidate<HicdataResponse>()
export const validHicGenomeRequest = createValidate<HicGenomeRequest>()
export const validHicGenomeResponse = createValidate<HicGenomeResponse>()
export const validHicstatRequest = createValidate<HicstatRequest>()
export const validHicstatResponse = createValidate<HicstatResponse>()
export const validGetSampleWSImagesRequest = createValidate<GetSampleWSImagesRequest>()
export const validGetSampleWSImagesResponse = createValidate<GetSampleWSImagesResponse>()
export const validDERequest = createValidate<DERequest>()
export const validDEResponse = createValidate<DEResponse>()
export const validBoxPlotRequest = createValidate<BoxPlotRequest>()
export const validBoxPlotResponse = createValidate<BoxPlotResponse>()
export const validgetcategoriesRequest = createValidate<getcategoriesRequest>()
export const validgetcategoriesResponse = createValidate<getcategoriesResponse>()
export const validTermdbClusterRequest = createValidate<TermdbClusterRequest>()
export const validTermdbClusterResponse = createValidate<TermdbClusterResponse>()
export const validTermdbGetSampleImagesRequest = createValidate<TermdbGetSampleImagesRequest>()
export const validTermdbGetSampleImagesResponse = createValidate<TermdbGetSampleImagesResponse>()
export const validTermdbTopTermsByTypeRequest = createValidate<TermdbTopTermsByTypeRequest>()
export const validTermdbTopTermsByTypeResponse = createValidate<TermdbTopTermsByTypeResponse>()
export const validgetdescrstatsRequest = createValidate<getdescrstatsRequest>()
export const validgetdescrstatsResponse = createValidate<getdescrstatsResponse>()
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
