export type BurdenRequest = {
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
	keys: string[]
	rows: number[][]
}
