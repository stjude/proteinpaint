export type BurdenRequest = {
	genome: string
	dslabel: string
	/** A number representing the diagnostic group. It is a specific identifier for a diagnostic group */
	diaggrp: number
	/** A number representing sex, used to specify gender-related criteria in the burden analysis */
	sex: number
	/** A number, possibly indicating a specific attribute related to race or ethnicity, such as whether the individual is White */
	white: number
	/** A number representing the age at diagnosis, which is an important parameter in the analysis */
	agedx: number
	/** A number related to a medical treatment or drug called "bleomycin" */
	bleo: number
	/** A number related to a medical treatment or drug called "etoposide" */
	etop: number
	/** A number related to a medical treatment or drug called "cisplatin" */
	cisp: number
	/** A number related to a medical treatment or drug called "carboplatin" */
	carbo: number
	/** A number related to the use of steroids as part of the analysis */
	steriod: number
	/** A number related to a medical treatment or drug called "vincristine" */
	vcr: number
	/** A number related to a medical treatment or drug called "High dose methotrexate" */
	hdmtx: number
	/** A number possibly related to early diagnosis/changes to track cognitive decline/impairment using the iTMT approach as part of the burden analysis */
	itmt: number
	/** A number related to Convection Enhanced Delivery, a technique designed to deliver drugs directly into the tumor */
	ced: number
	/** A number related to a medical treatment or drug called "doxycyline" or "doxorubicin" */
	dox: number
	/** A number, possibly indicating an attribute related to the heart */
	heart: number
	/** A number, possibly indicating an attribute related to the brain */
	brain: number
	/** A number, possibly indicating an attribute related to the abdomen */
	abd: number
	/** A number, possibly indicating an attribute related to the pelvis */
	pelvis: number
	/** A number, possibly indicating an attribute related to the chest */
	chest: number
}

export type BurdenResponse = {
	status: string
	keys: string[]
	rows: number[][]
}
