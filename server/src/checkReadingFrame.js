/*
obj{} is the json object of a transcript
.strand '+/-'
.isoform STR
.name STR
.codingstart INT
	missing if the transcript is noncoding
.codingstop INT
.exon[]
	array of exons, 

str:
	the `exonFrames` field of ucsc gene table, with comma-joined -1/0/1/2 integers for every exon
	same length as obj.exon[] but ordered in ascending order!

if the first coding exon has a frame of 1/2 but not 0, the "startCodonFrame" attribute will be added to obj
so that it can be properly translatec
*/
export default function (obj, str) {
	if (!obj.codingstart) {
		// not coding
		return
	}
	const startCodonPos = obj.strand == '+' ? obj.codingstart : obj.codingstop
	let idx = obj.exon.findIndex(i => i[1] >= startCodonPos && i[0] <= startCodonPos)
	if (idx == -1) throw 'start codon not matched to an exon: ' + JSON.stringify(obj)

	// ucsc frame string is sorted with ascending order of exon positions
	// and obj.exon[] array is from 5' to 3'
	// so if strant=-, must reverse idx to match with ucsc frame string order
	if (obj.strand == '-') {
		idx = obj.exon.length - idx - 1
	}

	const frame = str.split(',')[idx]
	if (frame == '-1') throw 'start codon frame is -1: ' + obj.isoform
	if (frame != '0') {
		if (frame == '1' || frame == '2') {
			obj.startCodonFrame = Number.parseInt(frame)
			//console.error(obj.isoform, obj.name, frame, obj.strand) // for review
		} else {
			throw 'start codon frame not 0/1/2: ' + frame + ' ' + obj.isoform
		}
	}
}
