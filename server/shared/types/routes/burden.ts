/**
 * @diaggrp - A number representing the diagnostic group. It is a specific identifier for a diagnostic group.
 * @sex - A number representing sex, used to specify gender-related criteria in the burden analysis.
 * @white - A number, possibly indicating a specific attribute related to race or ethnicity, such as whether the individual is White.
 * @agedx - A number representing the age at diagnosis, which is an important parameter in the analysis.
 * @bleo - A number related to a medical treatment or drug called "bleomycin"
 * @etop - A number related to a medical treatment or drug called "etoposide"
 * @cisp - A number related to a medical treatment or drug called "cisplatin"
 * @carbo - A number related to a medical treatment or drug called "carboplatin"
 * @steriod - A number related to the use of steroids as part of the analysis.
 * @vcr - A number related to a medical treatment or drug called "vincristine"
 * @hdmtx - A number related to a medical treatment or drug called "High dose methotrexate"
 * @itmt - A number possibly related to early diagnosis/changes to track cognitive decline/impairment using the iTMT approach as part of the burden analysis.
 * @ced - A number related to Convection Enhanced Delivery, a technique designed to deliver drugs directly into the tumor.
 * @dox - A number related to a medical treatment or drug called "doxycyline" or "doxorubicin"
 * @heart -  A number, possibly indicating an attribute related to the heart
 * @brain - A number, possibly indicating an attribute related to the brain.
 * @abd - A number, possibly indicating an attribute related to the abdomen.
 * @pelvis - A number, possibly indicating an attribute related to the pelvis.
 * @chest - A number, possibly indicating an attribute related to the chest.
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
