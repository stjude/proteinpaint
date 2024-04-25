export class FirstChrX {
	chrorder: any
	chrx: string
	chry: string

	constructor(chrorder: any, chrx: string, chry: string) {
		this.chrorder = chrorder
		this.chrx = chrx //state.x.chr
		this.chry = chry //state.y.chr
	}

	isFirstX() {
		if (this.chrx == this.chry) return true
		return this.chrorder.indexOf(this.chrx) < this.chrorder.indexOf(this.chry)
	}
}
