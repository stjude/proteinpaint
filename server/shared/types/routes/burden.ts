/**
 * @param diaggrp - A number representing the diagnostic group. It is a specific identifier for a diagnostic group.
 * @param sex - A number representing sex, used to specify gender-related criteria in the burden analysis.
 * @param white - A number, possibly indicating a specific attribute related to race or ethnicity, such as whether the individual is White.
 * @param agedx - A number representing the age at diagnosis, which is an important parameter in the analysis.
 * @param bleo - A number related to a medical treatment or drug called "bleomycin"
 * @param etop - A number related to a medical treatment or drug called "etoposide"
 * @param cisp - A number related to a medical treatment or drug called "cisplatin"
 * @param carbo - A number related to a medical treatment or drug called "carboplatin"
 * @param steriod - A number related to the use of steroids as part of the analysis.
 * @param vcr - A number related to a medical treatment or drug called "vincristine"
 * @param hdmtx - A number related to a medical treatment or drug called "High dose methotrexate"
 * @param itmt - A number possibly related to early diagnosis/changes to track cognitive decline/impairment using the iTMT approach as part of the burden analysis.
 * @param ced - A number related to Convection Enhanced Delivery, a technique designed to deliver drugs directly into the tumor.
 * @param dox - A number related to a medical treatment or drug called "doxycyline" or "doxorubicin"
 * @param heart -  A number, possibly indicating an attribute related to the heart
 * @param brain - A number, possibly indicating an attribute related to the brain.
 * @param abd - A number, possibly indicating an attribute related to the abdomen.
 * @param pelvis - A number, possibly indicating an attribute related to the pelvis.
 * @param chest - A number, possibly indicating an attribute related to the chest.
 */

export type BurdenRequest = {
	genome: string
	dslabel: string
	diaggrp: number
	sex: number
	white: number
	agedx: number
	bleo: number
	etop: number
	cisp: number
	carbo: number
	steriod: number
	vcr: number
	hdmtx: number
	itmt: number
	ced: number
	dox: number
	heart: number
	brain: number
	abd: number
	pelvis: number
	chest: number
}

export type BurdenResponse = {
	status: string
	keys: string[]
	rows: number[][]
}
