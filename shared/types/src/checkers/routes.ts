import { createValidate } from 'typia'
import { GetBrainImagingRequest, GetBrainImagingResponse } from '../routes/brainImaging.ts'
import { BurdenRequest, BurdenResponse } from '../routes/burden.ts'
import { DatasetRequest, DatasetResponse } from '../routes/dataset.ts'
import { DsDataRequest, DsDataResponse } from '../routes/dsdata.ts'
import { DZImagesRequest, DZImagesResponse } from '../routes/dzimages.ts'
import { GdcMafRequest, GdcMafResponse } from '../routes/gdc.maf.ts'
import { GdcMafBuildRequest } from '../routes/gdc.mafBuild.ts'
import { GdcTopMutatedGeneRequest, GdcTopMutatedGeneResponse } from '../routes/gdc.topMutatedGenes.ts'
import { GeneLookupRequest, GeneLookupResponse } from '../routes/genelookup.ts'
import { genesetEnrichmentRequest, genesetEnrichmentResponse } from '../routes/genesetEnrichment.ts'
import {
	genesetOverrepresentationRequest,
	genesetOverrepresentationResponse
} from '../routes/genesetOverrepresentation.ts'
import { HealthCheckResponse } from '../routes/healthcheck.ts'
import { HicdataRequest, HicdataResponse } from '../routes/hicdata.ts'
import { HicGenomeRequest, HicGenomeResponse } from '../routes/hicgenome.ts'
import { HicstatRequest, HicstatResponse } from '../routes/hicstat.ts'
import { GetSampleDZImagesRequest, GetSampleDZImagesResponse } from '../routes/sampledzimages.ts'
import { GetSampleWSImagesRequest, GetSampleWSImagesResponse } from '../routes/samplewsimages.ts'
import { DERequest, DEResponse } from '../routes/termdb.DE.ts'
import { BoxPlotRequest, BoxPlotResponse } from '../routes/termdb.boxplot.ts'
import { getcategoriesRequest, getcategoriesResponse } from '../routes/termdb.categories.ts'
import { TermdbClusterRequest, TermdbClusterResponse } from '../routes/termdb.cluster.ts'
import { TermdbGetSampleImagesRequest, TermdbGetSampleImagesResponse } from '../routes/termdb.getSampleImages.ts'
import { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse } from '../routes/termdb.getTopTermsByType.ts'
import { getdescrstatsRequest, getdescrstatsResponse } from '../routes/termdb.getdescrstats.ts'
import { getnumericcategoriesRequest, getnumericcategoriesResponse } from '../routes/termdb.getnumericcategories.ts'
import { getpercentileRequest, getpercentileResponse } from '../routes/termdb.getpercentile.ts'
import { getroottermRequest, getroottermResponse } from '../routes/termdb.getrootterm.ts'
import { gettermchildrenRequest, gettermchildrenResponse } from '../routes/termdb.gettermchildren.ts'
import {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../routes/termdb.singleSampleMutation.ts'
import { TermdbSinglecellDEgenesRequest, TermdbSinglecellDEgenesResponse } from '../routes/termdb.singlecellDEgenes.ts'
import { TermdbSinglecellDataRequest, TermdbSinglecellDataResponse } from '../routes/termdb.singlecellData.ts'
import { TermdbSinglecellsamplesRequest, TermdbSinglecellsamplesResponse } from '../routes/termdb.singlecellSamples.ts'
import { gettermsbyidsRequest, gettermsbyidsResponse } from '../routes/termdb.termsbyids.ts'
import {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '../routes/termdb.topVariablyExpressedGenes.ts'
import { getViolinRequest, getViolinResponse } from '../routes/termdb.violin.ts'
import { GetWSImagesRequest, GetWSImagesResponse } from '../routes/wsimages.ts'

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
export const validGdcMafBuildRequest = createValidate<GdcMafBuildRequest>()
export const validGdcTopMutatedGeneRequest = createValidate<GdcTopMutatedGeneRequest>()
export const validGdcTopMutatedGeneResponse = createValidate<GdcTopMutatedGeneResponse>()
export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
export const validgenesetEnrichmentRequest = createValidate<genesetEnrichmentRequest>()
export const validgenesetEnrichmentResponse = createValidate<genesetEnrichmentResponse>()
export const validgenesetOverrepresentationRequest = createValidate<genesetOverrepresentationRequest>()
export const validgenesetOverrepresentationResponse = createValidate<genesetOverrepresentationResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
export const validHicdataRequest = createValidate<HicdataRequest>()
export const validHicdataResponse = createValidate<HicdataResponse>()
export const validHicGenomeRequest = createValidate<HicGenomeRequest>()
export const validHicGenomeResponse = createValidate<HicGenomeResponse>()
export const validHicstatRequest = createValidate<HicstatRequest>()
export const validHicstatResponse = createValidate<HicstatResponse>()
export const validGetSampleDZImagesRequest = createValidate<GetSampleDZImagesRequest>()
export const validGetSampleDZImagesResponse = createValidate<GetSampleDZImagesResponse>()
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
