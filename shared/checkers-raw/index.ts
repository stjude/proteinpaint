import { createValidate } from 'typia'
import { BurdenRequest, BurdenResponse } from '../types/routes/burden.ts'
import { GdcMafRequest, GdcMafResponse } from '../types/routes/gdc.maf.ts'
import { GdcMafBuildRequest } from '../types/routes/gdc.mafBuild.ts'
import { GdcTopMutatedGeneRequest, GdcTopMutatedGeneResponse } from '../types/routes/gdc.topMutatedGenes.ts'
import { GeneLookupRequest, GeneLookupResponse } from '../types/routes/genelookup.ts'
import { HealthCheckResponse } from '../types/routes/healthcheck.ts'
import { HicdataRequest, HicdataResponse } from '../types/routes/hicdata.ts'
import { HicstatRequest, HicstatResponse } from '../types/routes/hicstat.ts'
import { getcategoriesRequest, getcategoriesResponse } from '../types/routes/termdb.categories.ts'
import { TermdbClusterRequest, TermdbClusterResponse } from '../types/routes/termdb.cluster.ts'
import { getdescrstatsRequest, getdescrstatsResponse } from '../types/routes/termdb.getdescrstats.ts'
import {
	getnumericcategoriesRequest,
	getnumericcategoriesResponse
} from '../types/routes/termdb.getnumericcategories.ts'
import { getpercentileRequest, getpercentileResponse } from '../types/routes/termdb.getpercentile.ts'
import { getroottermRequest, getroottermResponse } from '../types/routes/termdb.getrootterm.ts'
import { gettermchildrenRequest, gettermchildrenResponse } from '../types/routes/termdb.gettermchildren.ts'
import {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../types/routes/termdb.singleSampleMutation.ts'
import { TermdbSinglecellDataRequest, TermdbSinglecellDataResponse } from '../types/routes/termdb.singlecellData.ts'
import {
	TermdbSinglecellsamplesRequest,
	TermdbSinglecellsamplesResponse
} from '../types/routes/termdb.singlecellSamples.ts'
import { gettermsbyidsRequest, gettermsbyidsResponse } from '../types/routes/termdb.termsbyids.ts'
import {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '../types/routes/termdb.topVariablyExpressedGenes.ts'
import { getViolinRequest, getViolinResponse } from '../types/routes/termdb.violin.ts'

export const validBurdenRequest = createValidate<BurdenRequest>()
export const validBurdenResponse = createValidate<BurdenResponse>()
export const validGdcMafRequest = createValidate<GdcMafRequest>()
export const validGdcMafResponse = createValidate<GdcMafResponse>()
export const validGdcMafBuildRequest = createValidate<GdcMafBuildRequest>()
export const validGdcTopMutatedGeneRequest = createValidate<GdcTopMutatedGeneRequest>()
export const validGdcTopMutatedGeneResponse = createValidate<GdcTopMutatedGeneResponse>()
export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
export const validHicdataRequest = createValidate<HicdataRequest>()
export const validHicdataResponse = createValidate<HicdataResponse>()
export const validHicstatRequest = createValidate<HicstatRequest>()
export const validHicstatResponse = createValidate<HicstatResponse>()
export const validgetcategoriesRequest = createValidate<getcategoriesRequest>()
export const validgetcategoriesResponse = createValidate<getcategoriesResponse>()
export const validTermdbClusterRequest = createValidate<TermdbClusterRequest>()
export const validTermdbClusterResponse = createValidate<TermdbClusterResponse>()
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
