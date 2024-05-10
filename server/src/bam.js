import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import { spawn } from 'child_process'
import { Readable, Transform } from 'stream'
import { pipeline } from 'node:stream/promises'
import { createCanvas } from 'canvas'
import * as bamcommon from './bam.common.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import crypto from 'crypto'
import got from 'got'
import { interpolateRgb } from 'd3-interpolate'
import { match_complexvariant_rust } from './bam.kmer.indel.js'
import { basecolor, bplen } from '#shared/common.js'
import { gdcCheckPermission } from './bam.gdc.js'
import { fileSize } from '../shared/fileSize.js'

const clustalo_read_alignment = serverconfig.clustalo

/*
TODO
separate into new routes
/bam - tk rendering/read/align etc. for both gdc and non-gdc files
/bam/read - get one read
/bam/gdc/list - querying and listing files from gdc
/bam/gdc/cache - query gdc slicing api and cache on pp


XXX quick fix to be removed/disabled later
-- __tempscore 

1. reads are parsed into template/segments
2. mismatch checked if sufficient zoom in
3. divide reads to groups:
   upon first query, will produce all possible groups based on variant type
   - snv/indel yields up to 3 groups
     1. if by snv, will require mismatches
     2. if by complex variant, require read sequence to do read alignment
   - sv yields up to 2 groups
     method to be developed
   - default just 1 group with all the reads
   each group is assigned a hardcoded "type" string
   server returns all groups with non-0 templates
   client may zoom into one dense group, in which the group type will be indicated in server request
   so server should only generate group matching that type
4. stack, trim, and render each read group.
   currently code from here is agnostic to type of group
   but possible to implement type-specific method


when client zooms into one read group, server needs to know which group it is and only generate that group

*********************** q{}

.grouptype, .partstack{} // having partstack indicates it's in the partstack mode
.genome
.devicePixelRatio
.asPaired
.stacksegspacing
.canvaswidth
.downsample{} // added by determine_downsampling
.readcount_skipped
.variant{}
	.chr/pos/ref/alt
.sv{}
	.chrA/posA/chrB/posB
.regions[ r ]
	.chr/start/stop
	.scale()
	.referenceseq     str
	.to_printnt  bool
	.to_qual     bool
	.lines[]
.groups[ {} ]   multi-groups sharing the same set of regions, each with a set of reads
	.type
	.partstack{}  user triggered action
	.regions[]
		.x, .scale, .ntwidth // copied from q.regions
		.to_printnt // group-specific
		.to_qual
		
	.templates[]
	.stacks[]
	.returntemplatebox[]
	.stackheight
	.stackspace
	.overlapRP_multirows -- if to show overlap read pairs at separate rows, otherwise in one row one on top of the other
	.overlapRP_hlline  -- at overlap read pairs on separate rows, if to highlight with horizontal line
	.canvasheight
	.messages[ {} ] -- list of messages about this group. no longer server-rendered but passed to client for svg rendering
		.t str

*********************** template - segment - box

template {}
.y // initially stack idx, then replaced to be actual screen y
.x1, x2  // screen px, only for stacking not rendering
.segments[]
.height // screen px, only set when to check overlap read pair, will double row height

segment {}
.qname
.segstart
.segstop  // alignment start/stop, 0-based
.seq
.boxes[]
.forward
.ridx
.x1, x2  // screen px, used for rendering
.shiftdownrow // idx of mini stack
.tempscore // XXX explain what is it
.isfirst
.islast
.discord_wrong_insertsize
.discord_orientation
.discord_unmapped1 // Current read unmapped
.discord_unmapped2 // Mate of current read unmapped
.rnext, pnext // attribute is set when mate is on a different chr

box {}
.opr
.start // absolute bp, 0-based
.len   // #bp
.cidx  // start position in sequence/qual string
.s (read sequence) FIXME only keep box.s if sequence will be rendered
	if a read has no sequence ("*" as value), doing box.s=segment.seq.substr() will not break and returns blank string ''
	thus rendering code may have to test if box.s==''
.qual[]


*********************** function cascade

streamGdcBam2response
downloadGdcBam2cacheFile_withDenial // download gdc bam slice and write to cache file securely and deny unauthorized access
	get_gdc_bam
		index_bam
get_q
do_query
	query_reads
		determine_downsampling
		query_region
	divide_reads_togroups
		may_match_snv
			make_type2group
				duplicateRegions
		match_complexvariant
		match_sv
	do_alignOneGroup
		get_templates
	(for each group...)
		get_templates
			parse_one_segment
		may_checkrefseq4mismatch
			check_mismatch
		stack_templates
			may_trimstacks
		poststack_adjustq
			getstacksizebystacks
			get_refseq
		finalize_templates
			get_stacky
				overlapRP_setflag
				getrowheight_template_overlapread
		plot_template
			plot_segment
				mayClipArrowhead
		plot_insertions
	plot_pileup
		run_samtools_depth
		collect_softclipmismatch2pileup
route_getread
    query_oneread
      parse_one_segment
    convertread2html
    convertunmappedread2html  
*/

// match box color, for single read and normal read pairs
const match_hq = 'rgb(120,120,120)'
const match_lq = 'rgb(230,230,230)'
const qual2match = interpolateRgb(match_lq, match_hq)
// match box color, for ctx read pairs
const ctxpair_hq = '#d48b37'
const ctxpair_lq = '#dbc6ad'
const qual2ctxpair = interpolateRgb(ctxpair_lq, ctxpair_hq)
// discordant reads: soft green for background only, strong green for printing nt
const discord_wrong_insertsize_hq = '#3B7A57'
const discord_wrong_insertsize_lq = '#E5FFCC'
const qual2discord_wrong_insertsize = interpolateRgb(discord_wrong_insertsize_lq, discord_wrong_insertsize_hq)
// mismatch: soft red for background only without printed nt, strong red for printing nt on gray background
const mismatchbg_hq = '#d13232'
const mismatchbg_lq = '#ffdbdd'
const qual2mismatchbg = interpolateRgb(mismatchbg_lq, mismatchbg_hq)
// softclip: soft blue for background only, strong blue for printing nt
const softclipbg_hq = '#4888bf'
const softclipbg_lq = '#c9e6ff'
const qual2softclipbg = interpolateRgb(softclipbg_lq, softclipbg_hq)
// discord_unmapped: soft brown for background only, strong brown for printing nt
const discord_unmapped_hq = '#6B4423'
const discord_unmapped_lq = '#987654'
const qual2discord_unmapped = interpolateRgb(discord_unmapped_lq, discord_unmapped_hq)
// discord_orientation: soft pink for background only, strong pink for printing nt
const discord_orientation_hq = '#fc6df3'
const discord_orientation_lq = '#dea4da'
const qual2discord_orientation = interpolateRgb(discord_orientation_lq, discord_orientation_hq)
// insertion, text color gradient to correlate with the quality
// cyan
const insertion_hq = '#47FFFC' //'#00FFFB'
const insertion_lq = '#B2D7D7' //'#009290'

const qual2insertion = interpolateRgb(insertion_lq, insertion_hq)
const insertion_maxfontsize = 12
const insertion_minfontsize = 7

const deletion_linecolor = 'black'
const split_linecolorfaint = '#ededed' // if thin stack (hardcoded cutoff 2), otherwise use match_hq
const overlapreadhlcolor = 'blue'
const insertion_vlinecolor = 'black'
const pileup_totalcolor = '#e0e0e0'

const alt0_diff_score_color = '#FF0000'
const alt1_diff_score_color = '#6cc24a'
const alt2_diff_score_color = '#ffff00'
const alt3_diff_score_color = '#DEB887'
const alt4_diff_score_color = '#CD853F'
const alt5_diff_score_color = '#9a92ec'
const ref_diff_score_color = '#47C8FF'

const insertion_minpx = 1 // minimum px width to display an insertion
const minntwidth_toqual = 1 // minimum nt px width to show base quality
const minntwidth_overlapRPmultirows = 0.4 // minimum nt px width to show
const minntwidth_findmismatch = 0.9 // mismatch

const minstackheight2strandarrow = 7
const minstackheight2printbplenDN = 7
const maxfontsize2printbplenDN = 10
const minfontsize2printbplenDN = 7

const maxqual = 40

// tricky: on retina screen the individual nt boxes appear to have slight gaps in between
// adding this increment to the rendering of each nt box appear to fix the issue
// yet to be tested on a low-res screen
const ntboxwidthincrement = 0.5

// space between reads in the same stack, either 5 bp or 5 px, which ever greater
const readspace_px = 2
const readspace_bp = 5

const maxreadcount = 7000 // maximum number of reads to load
const maxcanvasheight = 1500 // ideal max canvas height in pixels
const max_returntemplatebox = 2000 // maximum number of reads per group, for which to return the "templatebox"
const minstackheight_returntemplatebox = 7 // minimum stack height (number of pixels) for which to return templatebox
const max_read_alignment = 200 // Max number of reads that can be aligned to reference sequence
const readpanel_DN_maxlength = 20 // Variable to define whether a deletion is rendered showing the reference or simply shown how big the deletion is. If greater, only the size of deletion is shown. If lower, the reference sequence is shown

const bases = new Set(['A', 'T', 'C', 'G'])
const gdcHashSecret = Math.random.toString()

/**************************
      gdc security
***************************

if a gdc file is used on client tk, every request (slice bam, view a bam, view a read etc) will carry both gdcFileUUID and gdcFilePosition

when the slice file will be saved in cache, an encrypted file name is computed and assigned to req.query.file=str
later when reading the file to load reads, detect:
if( req.query.gdcFileUUID) {
	file = join( cachedir_bam, req.query.file )
} else {
	file = join( tp, req.query.file )
}
if client send a computed cache file name only without uuid, the file name will be joined to wrong folder and inaccessible

every request carrying gdcFileUUID will be checked against gdc api for access using token/session
*/
export default function (genomes) {
	return async (req, res) => {
		try {
			if (req.query.gdcFileUUID) {
				if (typeof req.query.gdcFileUUID != 'string') throw 'gdcFileUUID not string'
				/****************************
				!!! always make an api query to verify access to prevent unauthorized access !!!
				****************************
				credential is token (for use outside gdc portal) or sessionid (for use inside gdc portal)

				req.query{} parameters:

				gdcFileUUID: str
				gdcFilePosition: str
					this pair of parameters must both be set, as file position is the position where gdc bam is sliced against
					both are required to do slicing
					if the slice will be stored as a cache file, both are used to compute the file name
					a different slice position will yield a different cache file name
					position can be "chr.start.stop", or "unmapped" (see below)

				downloadgdc:1
					present at the initial query to slice bam, either viewing or download; not in subsequent queries

				clientdownloadgdcslice:1
					present on clicking download button in block
				*/

				validateGdcFilePosition(req)

				// to access ds.getHostHeaders(), assign query.__genomes so later code can access gdc ds object as needed
				req.query.__genomes = genomes
				// because getHostHeaders() expects req.query.token;  should do getHostHeaders(req) and no need for this
				// right now only gdc uses token. if another api source need it too, may move these lines up
				const token = req.get('X-Auth-Token')
				if (token) req.query.token = token

				await gdcCheckPermission(req.query.gdcFileUUID, getGdcDs(genomes), req.query)

				// authorized! can proceed

				//if (req.query.stream2download) { await streamGdcBam2response(req, res) return } // no longer used

				// compute persistent cache file name using uuid etc; cache file name is never revealed to client
				req.query.file = getGDCcacheFileName(req)
			}

			if (req.query.downloadgdc) {
				res.send(await downloadGdcBam2cacheFile_withDenial(req))
				return
			}

			if (req.query.clientdownloadgdcslice) {
				await clientdownloadgdcsliceFromCache_withDenial(req, res)
				return
			}

			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'

			if (req.query.getread) {
				res.send(await route_getread(genome, req))
				return
			}

			// finished all routes that are not about rendering
			// following is to deal with rendering requests

			const starttime = serverconfig.debugmode ? new Date() : null

			const q = await get_q(genome, req)
			res.send(await do_query(q))

			if (serverconfig.debugmode) console.log('bam.js time ms', new Date() - starttime)
		} catch (e) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

async function clientdownloadgdcsliceFromCache_withDenial(req, res) {
	if (!req.query.gdcFileUUID || !req.query.gdcFilePosition || !req.query.file) {
		// dangerous: require all above so it must have gone through access checking
		throw 'clientdownloadgdcslice: unauthorized access'
	}
	// read the cached bam slice for client to download
	const file = path.join(serverconfig.cachedir_bam, req.query.file)
	const data = await fs.promises.readFile(file)
	res.writeHead(200, {
		'Content-Type': 'application/octet-stream',
		'Content-Disposition': 'attachment; filename=gdc.bam',
		'Content-Length': data.length
	})
	res.end(Buffer.from(data, 'binary'))
}

/* 
to visualize a bam tk, a cache file will be created for the slice
no limit on request region size
limit on cache file size by cacheMaxSize (data amount calculated on the fly while streaming)
this allows to slice large region on a low-depth file, and can auto-abort in case of high-depth file
*/
function validateGdcFilePosition(req) {
	if (!req.query.gdcFilePosition) throw 'gdcFileUUID is present but gdcFilePosition is missing'
	if (typeof req.query.gdcFilePosition != 'string') throw 'gdcFilePosition is not string'
	if (req.query.gdcFilePosition == 'unmapped') return // in download mode
	// not in download mode. value should be a coord "chr2.29192773.29921586" or "chr16:31189077-31189197"
	const tmp = req.query.gdcFilePosition.split(/[.:-]/)
	if (tmp.length != 3) throw 'gdcFilePosition not 3 fields'
	const start = Number(tmp[1]),
		stop = Number(tmp[2])
	if (!Number.isInteger(start) || !Number.isInteger(stop) || start > stop) throw 'gdcFilePosition invalid start/stop'
}

function getGdcDs(genomes) {
	const d = genomes.hg38?.datasets?.GDC
	if (!d) throw 'hg38.datasets.GDC missing'
	return d
}

async function plot_diff_scores(q, group, templates, max_diff_score, min_diff_score) {
	const multiplication_factor = q.diff_score_plotwidth / (max_diff_score - min_diff_score)
	const diff_score_bar_width = max_diff_score * multiplication_factor - min_diff_score * multiplication_factor
	const canvas = createCanvas(diff_score_bar_width * q.devicePixelRatio, group.canvasheight * q.devicePixelRatio)
	const ctx = canvas.getContext('2d')
	//const read_height = group.templates[0].r.ntwidth
	if (q.devicePixelRatio > 1) {
		ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
	}
	const diff_scores_list = templates.map(i => i.__tempscore)
	const read_height = group.canvasheight / diff_scores_list.length
	let i = 0
	const dist_bw_reads = group.stackspace / group.canvasheight
	for (const diff_scores of diff_scores_list) {
		//console.log('diff_scores:', diff_scores)
		let iter = 0
		for (const diff_score of diff_scores) {
			if (diff_score == 'alt0') {
				// Hardcoding alt groups for max of five groups only. How to handle more than 5 groups?
				ctx.fillStyle = alt0_diff_score_color
			} else if (diff_score == 'ref') {
				ctx.fillStyle = ref_diff_score_color
			} else if (diff_score == 'alt1') {
				ctx.fillStyle = alt1_diff_score_color
			} else if (diff_score == 'alt2') {
				ctx.fillStyle = alt2_diff_score_color
			} else if (diff_score == 'alt3') {
				ctx.fillStyle = alt3_diff_score_color
			} else if (diff_score == 'alt4') {
				ctx.fillStyle = alt4_diff_score_color
			} else if (diff_score == 'alt5') {
				ctx.fillStyle = alt5_diff_score_color
			}
			ctx.fillRect(
				multiplication_factor * iter,
				i * read_height,
				multiplication_factor,
				read_height - dist_bw_reads * read_height
			)
			iter += 1
		}
		i += 1
	}
	return {
		height: group.canvasheight,
		width: diff_score_bar_width,
		src: canvas.toDataURL(),
		read_height: read_height
	}
}

async function plot_pileup(q, templates) {
	const canvas = createCanvas(q.canvaswidth * q.devicePixelRatio, q.pileupheight * q.devicePixelRatio)
	const ctx = canvas.getContext('2d')
	if (q.devicePixelRatio > 1) {
		ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
	}

	const bplst = []
	// array of array, stores depth for each region, each ele is { .position, .total/A/T/C/G }
	let maxValue = 0 // max depth from all regions

	for (const [ridx, r] of q.regions.entries()) {
		bplst[ridx] = await run_samtools_depth(q, r)
		// collect softclip/mismatch into bplst, will increase .total
		collect_softclipmismatch2pileup(ridx, r, templates, bplst[ridx])
		for (const b of bplst[ridx]) {
			if (b) maxValue = Math.max(maxValue, b.total)
		}
	}

	for (const [ridx, r] of q.regions.entries()) {
		const sf = q.pileupheight / maxValue
		for (const bp of bplst[ridx]) {
			if (!bp) continue // gap from zoomed out mode

			const x0 = (bp.position - r.start) * r.ntwidth + r.x
			const x = r.ntwidth >= 1 ? x0 : Math.floor(x0) // floor() is necessary to remove white lines when zoomed out for unknown reason

			const barwidth = Math.max(1, r.ntwidth) // * (r.width / q.canvaswidth) // when in zoomed out mode, each bar is one pixel, thus the width=1

			// total coverage of this bp
			{
				ctx.fillStyle = pileup_totalcolor
				const h = bp.total * sf
				ctx.fillRect(x, q.pileupheight - h, barwidth, h)
			}

			let y = 0 // cumulate bar height of mismatch bp
			if (bp.A) {
				ctx.fillStyle = basecolor.A
				const h = bp.A * sf
				ctx.fillRect(x, q.pileupheight - y - h, barwidth, h)
				y += h
			}
			if (bp.C) {
				ctx.fillStyle = basecolor.C
				const h = bp.C * sf
				ctx.fillRect(x, q.pileupheight - y - h, barwidth, h)
				y += h
			}
			if (bp.G) {
				ctx.fillStyle = basecolor.G
				const h = bp.G * sf
				ctx.fillRect(x, q.pileupheight - y - h, barwidth, h)
				y += h
			}
			if (bp.T) {
				ctx.fillStyle = basecolor.T
				const h = bp.T * sf
				ctx.fillRect(x, q.pileupheight - y - h, barwidth, h)
				y += h
			}
			if (bp.softclip) {
				ctx.fillStyle = softclipbg_hq
				const h = bp.softclip * sf
				ctx.fillRect(x, q.pileupheight - y - h, barwidth, h)
			}
		}
	}
	return {
		width: q.canvaswidth,
		maxValue,
		src: canvas.toDataURL()
	}
}

function collect_softclipmismatch2pileup(ridx, r, templates, bplst) {
	// for a region, use segments from this region to add mismatches to bplst depth
	// only work for per bp depth, not binned depth
	for (const template of templates) {
		for (const segment of template.segments) {
			if (segment.ridx != ridx || Math.max(segment.segstart, r.start) > Math.min(segment.segstop, r.stop)) {
				// segment not in this region
				continue
			}
			for (const box of segment.boxes) {
				if (r.ntwidth >= 1) {
					// zoomed in, plot softclip/mismatch as basepairs
					if ((box.opr == 'S' || box.opr == 'X') && box.s) {
						for (let boxsi = 0; boxsi < box.s.length; boxsi++) {
							const bpposition = box.start + boxsi
							const bpitem = bplst.find(i => i.position == bpposition)
							// each item of bplst is one basepair
							// must directly match box bp position with bplst[].position
							// as bplst[] may be discontinuous, cannot use bpposition-bplst[0].position to get its array index
							if (!bpitem) {
								// bpposition out of view range
								continue
							}
							const nt = box.s[boxsi]
							bpitem[nt] = 1 + (bpitem[nt] || 0)
							if (box.opr == 'S') {
								// samtools depth does not include softclip, need to add to total
								bpitem.total++
							}
						}
					}
				} else {
					// zoomed out, plot only softclip
					if (box.opr == 'S') {
						// for the stretch of softclip, apply count to bplst
						// use softclip start/stop coordinate to infer array index in bplst
						// don't require box.s
						const clipstartidx = Math.floor((box.start - r.start) * r.ntwidth)
						const clipstopidx = Math.floor((box.start + box.len - r.start) * r.ntwidth)
						for (let i = clipstartidx; i <= clipstopidx; i++) {
							const bpitem = bplst[i]
							if (!bpitem) {
								// should not happen
								continue
							}
							bpitem.softclip = 1 + (bpitem.softclip || 0)
							bpitem.total++ // increment total, same as above
						}
					}
				}
			}
		}
	}
}
function softclip_mismatch_pileup2(ridx, r, templates, bplst) {
	// for a region, use segments from this region to add mismatches to bplst depth
	// only work for per bp depth, not binned depth
	let bp_iter = 0
	for (const template of templates) {
		for (const segment of template.segments) {
			if (segment.ridx != ridx || Math.max(segment.segstart, r.start) > Math.min(segment.segstop, r.stop)) {
				// segment not in this region
				continue
			}
			bp_iter = segment.segstart - bplst[0].position - 1 // Records position in the view range
			let first_element_of_cigar = 1
			// i haven't reviewed logic below. if bplst[] contains bins, then here should update as well.
			for (const box of segment.boxes) {
				if (box.opr == 'S' || box.opr == 'I') {
					// Checking to see if the first element of cigar is softclip or not
					if (first_element_of_cigar == 1) {
						bp_iter = bp_iter - box.len
						first_element_of_cigar = 0
					}
					// Calculating soft-clip pileup here
					for (let j = bp_iter; j < box.len + bp_iter; j++) {
						if (j < 0) {
							continue
						} // When a read starts before the current view range
						else if (j > r.stop - bplst[0].position - 2) {
							break
						} // When a read extends beyond current view range
						else {
							if (!bplst[j].softclip) {
								bplst[j].softclip = 1
								if (box.opr == 'I') {
									bplst[j].ref = bplst[j].ref - 1
								}
							} else {
								bplst[j].softclip += 1
								if (box.opr == 'I') {
									bplst[j].ref = bplst[j].ref - 1
								}
							}

							// Check to see if softclip is reference allele or not
							if (box.s[j - bp_iter] == 'A') {
								if (!bplst[j].softclipA) {
									bplst[j].softclipA = 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								} else {
									bplst[j].softclipA += 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								}
							}

							if (box.s[j - bp_iter] == 'T') {
								if (!bplst[j].softclipT) {
									bplst[j].softclipT = 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								} else {
									bplst[j].softclipT += 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								}
							}

							if (box.s[j - bp_iter] == 'C') {
								if (!bplst[j].softclipC) {
									bplst[j].softclipC = 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								} else {
									bplst[j].softclipC += 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								}
							}

							if (box.s[j - bp_iter] == 'G') {
								if (!bplst[j].softclipG) {
									bplst[j].softclipG = 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								} else {
									bplst[j].softclipG += 1
									if (box.opr == 'I') {
										bplst[j].ref = bplst[j].ref - 1
									}
								}
							}
						}
					}
					bp_iter += box.len
					continue
				} else {
					bp_iter += box.len
					first_element_of_cigar = 0
				}
			}

			for (let i = 0; i < segment.boxes.length; i++) {
				if (segment.boxes[i].opr == 'X') {
					//console.log("segment.boxes[i]:",template.segment.boxes[i])
					bp_iter = segment.boxes[i].start - bplst[0].position - 1 // Records position in the view range
					//console.log("r.start:",r.start)
					//console.log("bp_iter:",bp_iter)
					if (bp_iter >= 0 && r.stop - bplst[0].position - 2 >= bp_iter) {
						// Checking to see if the variant is within the view range
						if (segment.boxes[i].s == 'A') {
							if (!bplst[bp_iter].A) {
								bplst[bp_iter].A = 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							} else {
								bplst[bp_iter].A += 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							}
						}
						if (segment.boxes[i].s == 'T') {
							if (!bplst[bp_iter].T) {
								bplst[bp_iter].T = 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							} else {
								bplst[bp_iter].T += 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							}
						}
						if (segment.boxes[i].s == 'C') {
							if (!bplst[bp_iter].C) {
								bplst[bp_iter].C = 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							} else {
								bplst[bp_iter].C += 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							}
						}
						if (segment.boxes[i].s == 'G') {
							if (!bplst[bp_iter].G) {
								bplst[bp_iter].G = 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							} else {
								bplst[bp_iter].G += 1
								bplst[bp_iter].ref = bplst[bp_iter].ref - 1
							}
						}
					}
				}
			}
		}
	}
}

async function getFilefullpathOrUrl(req) {
	if (req.query.gdcFileUUID) {
		// is gdc bam slice, join with cache dir
		const cachefile = path.join(serverconfig.cachedir_bam, req.query.file)
		// before the file is accessed, test if missing! if so re-slice in case the query runs on a different worker on the gdc environment..
		await mayReSliceFile(req, cachefile)
		return [cachefile, null]
	}
	// not gdc file; either a file (join with tp/) or url
	const [e, _file, isurl] = utils.fileurl(req)
	if (e) throw e
	const dir = isurl ? await utils.cache_index(_file, req.query.indexURL || _file + '.bai') : null
	return [_file, dir]
}

async function get_q(genome, req) {
	const [filefullpath, dir] = await getFilefullpathOrUrl(req)
	const q = {
		genome,
		file: filefullpath,
		fileIsTruncated: await samtoolsQuickcheck(filefullpath), // flag to record status and used repeatedly
		dir,
		asPaired: req.query.asPaired,
		getcolorscale: req.query.getcolorscale,
		//_numofreads: 0, // temp, to count num of reads while loading and detect above limit
		devicePixelRatio: req.query.devicePixelRatio ? Number(req.query.devicePixelRatio) : 1
	}

	if (req.query.pileupheight) {
		q.pileupheight = Number(req.query.pileupheight)
		if (Number.isNaN(q.pileupheight)) throw '.pileupheight is not integer'
	}
	if (req.query.drop_pcrduplicates) {
		q.drop_pcrduplicates = true
	}
	if (req.query.drop_supplementary_alignments) {
		q.drop_supplementary_alignments = true
	}

	if (req.query.variant) {
		q.diff_score_plotwidth = Number(req.query.diff_score_plotwidth)
		if (req.query.max_diff_score) {
			q.max_diff_score = Number(req.query.max_diff_score)
			q.min_diff_score = Number(req.query.min_diff_score)
		}
		const t = req.query.variant.split('.')
		q.strictness = req.query.strictness
		if (!Number.isInteger(t.length % 4)) throw 'invalid variant, not chr.pos.ref.alt'
		q.alleleAlreadyUpdated = req.query.alleleAlreadyUpdated
		if (q.alleleAlreadyUpdated) {
			q.altseqs = req.query.altseqs
			q.refseqs = req.query.refseqs
			q.altalleles = req.query.altalleles
			q.refalleles = req.query.refalleles
			q.leftflankseqs = req.query.leftflankseqs
			q.rightflankseqs = req.query.rightflankseqs
			q.ref_positions = req.query.ref_positions
		}

		const num_variants = t.length / 4
		const variants = []
		for (let i = 0; i < num_variants; i++) {
			variants.push({ chr: t[i * 4], pos: Number(t[i * 4 + 1]), ref: t[i * 4 + 2], alt: t[i * 4 + 3] })
		}
		q.variant = variants
		if (req.query.alignOneGroup) {
			// value is group name to be realigned
			q.alignOneGroup = req.query.alignOneGroup
		}
		if (Number.isNaN(q.variant.pos)) throw 'variant pos not integer'
	} else if (req.query.sv) {
		const t = req.query.sv.split('.')
		if (t.length < 6) throw 'invalid sv, not chrA.posA.chrB.posB'
		q.sv = {
			chrA: t[0],
			startA: Number(t[1]),
			strandA: Number(t[2]),
			chrB: t[3],
			startB: Number(t[4]),
			strandB: Number(t[5])
		}
		if (Number.isNaN(q.sv.startA)) throw 'sv.startA not integer'
		if (Number.isNaN(q.sv.startB)) throw 'sv.startB not integer'
	}

	if (Number.isFinite(Number(req.query.stackstart))) {
		// to be assigned to the read group being modified
		if (!req.query.stackstop) throw '.stackstop missing'
		q.partstack = {
			start: Number(req.query.stackstart),
			stop: Number(req.query.stackstop)
		}

		if (Number.isNaN(q.partstack.start)) throw '.stackstart not integer'
		if (Number.isNaN(q.partstack.stop)) throw '.stackstop not integer'
		if (!req.query.grouptype) throw '.grouptype required for partstack'
		q.grouptype = req.query.grouptype
	}

	if (req.query.gdc) {
	} else if (req.query.nochr) {
		q.nochr = typeof req.query.nochr == 'string' ? JSON.parse(req.query.nochr) : req.query.nochr // parse "true" into json true
	} else {
		// info not provided
		q.nochr = await utils.bam_ifnochr(q.file, genome, q.dir, q.fileIsTruncated)
	}
	q.regions = req.query.regions
	if (!Array.isArray(q.regions) || q.regions.length == 0) throw 'q.regions[] not non-empty array'

	let maxntwidth = 0
	for (const r of q.regions) {
		if (!r.chr) throw '.chr missing from a region'
		if (!Number.isInteger(r.start)) throw '.start not integer of a region'
		if (!Number.isInteger(r.stop)) throw '.stop not integer of a region'
		r.scale = p => Math.ceil((r.width * (p - r.start)) / (r.stop - r.start))
		r.ntwidth = r.width / (r.stop - r.start)
		maxntwidth = Math.max(maxntwidth, r.ntwidth)
	}

	// max ntwidth determines segment spacing in a stack, across all regions
	q.stacksegspacing = Math.max(readspace_px, readspace_bp * maxntwidth)

	q.readcount_skipped = 0 // count number of reads retrieved from view range but not visible e.g. spliced intron

	return q
}

/*
***************  stop gap measure  *********************
to deal with case where slice file not found in cache dir
this happens on gdc backend where multiple pp container processes are launched
and each using its own cachedir
first the slicing request goes to 1st container, writing to its cachedir
then visualization requests goes to 2nd container, there the slice file is not found in cachedir
call this function to force download
can delete this function when gdc containers share a cachedir
*/
async function mayReSliceFile(req, cachefile) {
	/* uncomment these two lines to test on local
	await fs.promises.unlink(cachefile)
	await fs.promises.unlink(cachefile+'.bai')
	*/
	try {
		if (!(await utils.file_not_exist(cachefile))) {
			// bam file exists
			return
		}

		// slice file not found; force to download slice here

		const bakRegions = req.query.regions
		const tmp = req.query.gdcFilePosition.split(/[.:-]/)
		req.query.regions = [{ chr: tmp[0], start: Number(tmp[1]), stop: Number(tmp[2]) }]
		await downloadGdcBam2cacheFile_withDenial(req)
		req.query.regions = bakRegions
	} catch (e) {
		throw e
	}
}

async function do_query(q) {
	await query_reads(q)
	//delete q._numofreads // read counter no longer needed after loading
	q.totalnumreads = q.regions.reduce((i, j) => i + j.lines.length, 0)

	const result = {
		nochr: q.nochr,
		count: {
			r: q.totalnumreads
		},
		groups: []
	}
	if (q.read_limit_reached) {
		// When maximum read limit is reached
		result.count.read_limit_reached = q.read_limit_reached
	}
	q.canvaswidth = q.regions[q.regions.length - 1].x + q.regions[q.regions.length - 1].width
	{
		const out = await divide_reads_togroups(q) // templates
		q.groups = out.groups
		if (q.variant) {
			result.ref_alleles = out.refalleles // Its possible the input ref allele is "-" or ""(blank). In that case it needs to be queried from the reference genome
			result.alt_alleles = out.altalleles // Its possible the input alt allele is "-" or ""(blank). In that case it needs to be deduced from the reference allele

			result.allele_positions = out.ref_positions // Start position needs to be changed if any of the alleles is blank or missing
			result.strand_probability = out.strand_probability // Contains FS score of strand bias i.e forward/reverse vs alternate/reference
			result.alternate_forward_count = out.alternate_forward_count // Number of reads classified as alternate forward
			result.reference_forward_count = out.reference_forward_count // Number of reads classified as reference forward
			result.alternate_reverse_count = out.alternate_reverse_count // Number of reads classified as alternate reverse
			result.reference_reverse_count = out.reference_reverse_count // Number of reads classified as reference reverse

			if (out.strand_significance == true) {
				// Tells whether the FS score is significant/insignificant
				result.strand_significance = true
			}
			if (!q.alleleAlreadyUpdated) {
				// Prevent passing ref and alt sequences to client side in subsequent requests
				result.refseqs = out.refseqs // Passing complete reference sequence back to client side for alignment
				result.altseqs = out.altseqs // Passing complete alternate sequence back to client side for alignment
				result.leftflankseqs = out.leftflankseqs // Passing leftflankseq to client side
				result.rightflankseqs = out.rightflankseqs // Passing rightflankseq to client side
				result.ref_positions = out.ref_positions
				result.refalleles = out.refalleles
				result.altalleles = out.altalleles
			}
		}

		// XXX clean up logic
		if (Number.isFinite(q.max_diff_score) && q.variant) {
			// In partstack mode
			result.max_diff_score = q.max_diff_score
			result.min_diff_score = q.min_diff_score
		} else if (Number.isFinite(out.max_diff_score)) {
			result.max_diff_score = out.max_diff_score
			result.min_diff_score = out.min_diff_score
		}

		if (out.refalleleerror) result.refalleleerror = out.refalleleerror
	}

	if (result.count.r == 0) {
		// simply show this message in the track on client
		throw 'No reads in view range.'
		//q.groups[0].messages.push({ t: 'No reads in view range.' })
	}

	if (q.alignOneGroup) {
		// find the group to be realigned
		const group = q.groups.find(i => i.type == q.alignOneGroup)
		if (!group) throw 'cannot find group for realignment'
		let templates = get_templates(q, group)
		templates = stack_templates(group, q, templates) // add .stacks[], .returntemplatebox[]
		return await do_alignOneGroup(group, q, templates)
	}
	// render read alignment for all groups

	// XXX TODO not to collect all reads into array
	let templates_total = []
	for (const group of q.groups) {
		// do stacking for each group separately
		// attach temp attributes directly to "group", rendering result push to results.groups[]

		// parse reads and cigar
		let templates = get_templates(q, group)
		templates = stack_templates(group, q, templates) // add .stacks[], .returntemplatebox[]
		await poststack_adjustq(group, q, templates)

		// read quality is not parsed yet
		await may_checkrefseq4mismatch(templates, q)
		finalize_templates(group, templates, q) // set .canvasheight

		// result obj of this group
		const gr = {
			type: group.type,
			width: q.canvaswidth,
			height: group.canvasheight,
			stackheight: group.stackheight,
			stackcount: group.stacks.length,
			allowpartstack: group.allowpartstack,
			templatebox: group.returntemplatebox,
			count: { r: templates.reduce((i, j) => i + j.segments.length, 0) }
		}

		const canvas = createCanvas(q.canvaswidth * q.devicePixelRatio, group.canvasheight * q.devicePixelRatio)
		const ctx = canvas.getContext('2d')
		if (q.devicePixelRatio > 1) {
			ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
		}

		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'

		gr.messages = group.messages
		gr.messagerowheights = 0
		for (const template of templates) {
			// group.templates
			plot_template(ctx, template, group, q)
		}

		plot_insertions(ctx, group, q, templates)

		if (q.asPaired) gr.count.t = templates.length // group.templates
		if (q.variant) {
			// diff scores plotted only if a variant is specified by user
			gr.diff_scores_img = await plot_diff_scores(q, group, templates, result.max_diff_score, result.min_diff_score)
			if (gr.type == 'support_alt0') {
				gr.group_color = alt0_diff_score_color
			} else if (gr.type == 'support_alt1') {
				gr.group_color = alt1_diff_score_color
			} else if (gr.type == 'support_alt2') {
				gr.group_color = alt2_diff_score_color
			} else if (gr.type == 'support_alt3') {
				gr.group_color = alt3_diff_score_color
			} else if (gr.type == 'support_alt4') {
				gr.group_color = alt4_diff_score_color
			} else if (gr.type == 'support_alt5') {
				gr.group_color = alt5_diff_score_color
			} else if (gr.type == 'support_ref') {
				gr.group_color = ref_diff_score_color
			}
		}

		gr.src = canvas.toDataURL()
		result.groups.push(gr)
		templates_total = [...templates_total, ...templates]
	}
	if (q.readcount_skipped) result.count.skipped = q.readcount_skipped
	if (q.getcolorscale) result.colorscale = getcolorscale(q)
	if (!q.partstack) {
		// not in partstack mode, may do pileup plot
		if (result.count.r == 0) {
			// no reads, will not do pileup
			// FIXME
			// count.r is not reliable as it will count rnaseq reads splitting across intron and invisible (new issue)
			// to generate count.plotr and count.splitr through plotting, and when count.plotr==0 then don't do pileup
		} else {
			if (!q.pileupheight) throw 'pileupheight missing'
			result.pileup_data = await plot_pileup(q, templates_total)
		}
	}
	return result
}

async function do_alignOneGroup(group, q, templates) {
	// do alignment
	// call a function from a new script
	// get alignment data (text)
	let alignmentData
	if (q.variant) {
		if (group.type == 'support_ref') {
			let leftflankseq_length = q.leftflankseqs[0].length
			if (group.partstack) {
				alignmentData = await align_multiple_reads(
					templates,
					leftflankseq_length,
					group.partstack.start,
					group.partstack.stop,
					q.refseqs[0]
				) // Aligning ref-classified reads to reference allele
			} else {
				alignmentData = await align_multiple_reads(templates, leftflankseq_length, 0, 0, q.refseqs[0]) // Aligning ref-classified reads to reference allele
			}
		} else if (group.type == 'support_no') {
			// when category type is none category
			let leftflankseq_length = q.leftflankseqs[0].length
			if (group.partstack) {
				alignmentData = await align_multiple_reads(
					templates,
					leftflankseq_length,
					group.partstack.start,
					group.partstack.stop
				) // Aligning none/ambiguous classified reads
			} else {
				alignmentData = await align_multiple_reads(templates, leftflankseq_length) // Aligning ref-classified reads to reference allele
			}
		} else if (group.type == 'support_amb') {
			// Currently ambiguous group does not have read alignment? Will work on this later if needed
			throw 'Realignment of reads in ambiguous group is not currently implemented.'
		} else if (group.type.includes('support_alt')) {
			// Determining which alternate allele the reads must be realigned to
			for (let var_idx = 0; var_idx < q.variant.length; var_idx++) {
				if (group.type == 'support_alt' + var_idx.toString()) {
					let leftflankseq_length = q.leftflankseqs[var_idx].length
					if (group.partstack) {
						alignmentData = await align_multiple_reads(
							templates,
							leftflankseq_length,
							group.partstack.start,
							group.partstack.stop,
							q.altseqs[var_idx]
						) // Aligning alt-classified reads to alternate allele
					} else {
						alignmentData = await align_multiple_reads(templates, leftflankseq_length, 0, 0, q.altseqs[var_idx]) // Aligning alt-classified reads to alternate allele
					}
				}
			}
		} else {
			// Should not happen
			console.log('Unaccounted group, please check')
		}
	}
	return { alignmentData }
}

async function align_multiple_reads(
	templates,
	leftflankseq_length,
	partstack_start,
	partstack_stop,
	reference_sequence
) {
	const sequence_reads = templates.map(i => i.segments[0].seq)
	const qual_reads = templates.map(i => i.segments[0].qual)
	let fasta_sequence = ''

	let qual_sequence = ''
	if (reference_sequence) {
		// Will be true only for reference and alternate group
		fasta_sequence += '>seq\n' + reference_sequence.replace('\n', '') + '\n'
	}
	let i = 0
	for (const read of sequence_reads) {
		if (i < max_read_alignment) {
			fasta_sequence += '>seq\n' + read.replace('\n', '') + '\n'
			qual_sequence += qual2int(qual_reads[i].replace('\n', '')) + '\n'
			//console.log('qual_reads:', qual_reads)
		} else {
			break
		}
		i += 1
	}
	return await run_clustalo(
		fasta_sequence,
		max_read_alignment,
		sequence_reads.length,
		qual_sequence,
		leftflankseq_length,
		partstack_start,
		partstack_stop,
		reference_sequence
	) // If read alignment is blank , it may be because one of the reads have length > maxseqlen or number of reads > maxnumseq
}

function run_clustalo(
	fasta_sequence,
	max_read_alignment,
	num_reads,
	qual_sequence,
	leftflankseq_length,
	partstack_start,
	partstack_stop,
	reference_sequence
) {
	return new Promise((resolve, reject) => {
		const ps = spawn(clustalo_read_alignment, [
			'-i',
			'-', // Instructs ClustalO to accept input from stdin
			'-t',
			'DNA', // Input type - DNA
			'--outfmt=clu', // Output format ClustalW
			'--wrap=5000', // Allows upto 5000 nucleotides to be shown in a single row
			'--maxnumseq=' + (max_read_alignment + 1), // Maximum number of sequences to analyze set to max_read_alignment
			'--maxseqlen=1000' // Maximum length of each sequence = 1000
		])
		const stdout = []
		const stderr = []
		Readable.from(fasta_sequence).pipe(ps.stdin)
		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			console.log('stderr (clustalo):', stderr)
			reject(err)
		})
		ps.on('close', code => {
			//console.log('RawAlignment:', stdout.toString())
			let read_count = 0
			const ref_nucleotides = []
			const clustalo_output = {
				final_read_align: [],
				qual_r: [],
				qual_g: [],
				qual_b: []
			}
			let gaps_before_variant = 0 // This variable stores the number of gaps that have occured before the variant region. This helps in placing the variant bar in the correct position when there are gaps in ref sequence before variant region
			for (const read of stdout.toString().split('\n')) {
				if (read.includes('seq      ')) {
					// Remove "-" before/after the start/end of a sequence
					let nuc_count = 0 // This variable counts nucleotide positions w.r.t read
					let aligned_read = ''
					let global_nuc_count = 0 // This variable counts nucleotide positions w.r.t reference sequence

					let read_quality = ''
					if (read_count != 0 && reference_sequence) {
						// In case of reference and alternate group
						// First sequence is reference sequence
						read_quality = qual_sequence.split('\n')[read_count - 1].split(',')
					} else if (!reference_sequence) {
						// In case of none and ambiguous groups
						read_quality = qual_sequence.split('\n')[read_count].split(',')
					}
					let qual_r = ''
					let qual_g = ''
					let qual_b = ''
					for (const nucl of read.replace('seq      ', '')) {
						if (nucl == ',') continue // Ignoring ,
						if (nucl != '-') {
							nuc_count += 1
							aligned_read += nucl
							if (read_count == 0 && reference_sequence) {
								// In case of reference and alternate group
								// Looking at reference sequence
								ref_nucleotides.push(nucl)
							} else {
								if ((nucl == ref_nucleotides[global_nuc_count] && reference_sequence) || !reference_sequence) {
									const colors = qual2match(read_quality[nuc_count - 1] / maxqual)
										.replace('rgb(', '')
										.replace(')', '')
										.split(',')
									qual_r += colors[0] + ','
									qual_g += colors[1] + ','
									qual_b += colors[2] + ','
								} else if (nucl != ref_nucleotides[global_nuc_count] && reference_sequence) {
									const colors = qual2mismatchbg(read_quality[nuc_count - 1] / maxqual)
										.replace('rgb(', '')
										.replace(')', '')
										.split(',')
									qual_r += colors[0] + ','
									qual_g += colors[1] + ','
									qual_b += colors[2] + ','
								}
							}
						} else {
							if (
								nuc_count > 0 &&
								nuc_count < read.replace(/-/g, '').replace(/,/g, '').replace('seq      ', '').length
							) {
								// Only allows "-" inside reads to be displayed, removing those before/after the start/end of read
								aligned_read += nucl
								if (read_count == 0) {
									// Adding reference nucleotides
									ref_nucleotides.push(nucl)
									if (global_nuc_count < leftflankseq_length) {
										gaps_before_variant += 1 // Calculating gaps in ref sequence before variant region
									}
								}
							} else {
								aligned_read += ' '
								if (read_count == 0) {
									// Adding reference nucleotides
									ref_nucleotides.push(nucl)
								}
							}
							qual_r += '255,'
							qual_g += '255,'
							qual_b += '255,'
						}
						global_nuc_count += 1
					}
					read_count += 1
					clustalo_output.gaps_before_variant = gaps_before_variant // This variable stores the number of gaps that have occured before the variant region. This helps in placing the variant bar in the correct position when there are gaps in ref sequence before variant region
					if (reference_sequence) {
						// In case of reference and alternate group
						clustalo_output.read_count = read_count - 1 // Total reads aligned, subtracted one so as to exclude reference sequence
					} else {
						// In case of none and anbiguous group
						clustalo_output.read_count = read_count
					}
					clustalo_output.qual_r.push(qual_r)
					clustalo_output.qual_g.push(qual_g)
					clustalo_output.qual_b.push(qual_b)
					clustalo_output.final_read_align.push(aligned_read)
					if (partstack_start != 0 && partstack_stop != 0) {
						// In partstack mode
						clustalo_output.partstack_start = partstack_start
						clustalo_output.partstack_stop = partstack_stop
					}
				} else if (read.includes('FATAL:') || read.includes('ERROR:')) {
					// Possible problem in read-alignment
					console.log(read)
					reject(read)
				}
			}
			resolve(clustalo_output)
		})
	})
}

async function query_reads(q) {
	if (q.variant) {
		/* doing read alignment genotyping on a variant
		will only query reads from the variant region
		query region is centered on the variant position to be able to include softclip reads resulting from the mutation
		*/
		let varlen = 0
		let longest_variant_index = 0
		// Determine the variant which covers all other variants
		let i = 0
		let left_edge = q.variant[0].pos // Find pos of variant which extends the left most
		let right_edge = q.variant[0].pos + Math.max(q.variant[0].ref.length, q.variant[0].alt.length) // Find pos of variant which extends the right most
		for (const variant of q.variant) {
			const variant_length = Math.abs(variant.pos - Math.max(variant.ref.length, variant.alt.length))
			if (variant_length > varlen) {
				varlen = variant_length
				longest_variant_index = i
			}
			if (left_edge > variant.pos) {
				left_edge = variant.pos
			}
			if (right_edge < variant.pos + Math.max(variant.ref.length, variant.alt.length)) {
				right_edge = variant.pos + Math.max(variant.ref.length, variant.alt.length)
			}
			//console.log(variant.ref, variant.alt)
			i += 1
		}
		varlen = Math.floor(
			1.5 * Math.max(q.variant[longest_variant_index].ref.length, q.variant[longest_variant_index].alt.length)
		)

		//const varlen = Math.floor(1.5 * Math.max(q.variant.ref.length, q.variant.alt.length))
		const r = {
			chr: q.variant[0].chr,
			start: left_edge - varlen,
			stop: right_edge + varlen
		}
		await determine_downsampling(q, [r])
		await query_region(r, q)
		q.regions[0].lines = r.lines
		return
	}

	//if (q.sv) {
	//	/*
	//	if sv, query at the two breakends, and assign reads to two regions one for each breakend
	//	assume two regions
	//	otherwise, query for every region in q.regions
	//	*/
	//	return
	//}

	// query reads for all regions in q.regions
	await determine_downsampling(q, q.regions)

	for (const r of q.regions) {
		await query_region(r, q) // add r.lines[]
	}
}

/*
get total number of reads from all regions
determine downsampling ratio
regions can be defined by variant/sv position
*/
async function determine_downsampling(q, regions) {
	let totalreads = 0 // total number of reads from all regions
	for (const r of regions) {
		const args = ['view', '-c', q.file]

		if (q.fileIsTruncated) {
			// is truncated gdc slice. do not supply region
		} else {
			args.push((q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop)
		}

		try {
			await utils.get_lines_bigfile({
				isbam: true,
				args,
				dir: q.dir,
				callback: line => {
					const c = Number(line)
					if (!Number.isInteger(c)) throw 'total number of reads from a region not integer'
					totalreads += c
				}
			})
		} catch (e) {
			if (q.fileIsTruncated && e.includes(utils.SAMTOOLS_ERR_MSG.view)) {
				// expected err with truncated file, ignore
			} else {
				// unexpected err
				throw e
			}
		}
	}
	if (totalreads < maxreadcount * 1.1) {
		// no downsampling
		return
	}
	// more than 110% of max reads, will apply downsampling
	// 10% of maxreadcount as a unit, corresponding to 1 out of ten reads to be dropped
	const unitcount = (totalreads - maxreadcount) / (maxreadcount * 0.1)
	// keep/(keep+skip) is the downsampling ratio
	// pointer++ for every read so that for every #(keep+skip) reads, #skip reads are skipped
	q.downsample = {
		keep: 10,
		skip: Math.floor(unitcount),
		pointer: 0
	}
	q.read_limit_reached = totalreads // notify client
}

/*
for each region, query its data
if too many reads, kill the process and insert a message
*/
async function query_region(r, q) {
	r.lines = []
	const args = ['view', q.file]

	if (q.fileIsTruncated) {
		// file is truncated, which could be the case for gdc slice. read through all reads. do not supply query region to not to break samtools view
	} else {
		// normal file
		args.push((q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop)
	}

	try {
		await utils.get_lines_bigfile({
			isbam: true,
			args,
			dir: q.dir,
			callback: (line, ps) => {
				// Show/Hide PCR optical duplicates
				const flag = line.split('\t')[1]
				if (flag & 0x400 && q.drop_pcrduplicates) {
					return
				}
				// Show/Hide secondary alignments
				if (flag & 0x800 && q.drop_supplementary_alignments) {
					return
				}
				if (q.downsample) {
					// apply downsampling based on the ratio specified in .keep and .skip
					const d = q.downsample
					d.pointer++
					if (d.pointer >= d.keep && d.pointer < d.keep + d.skip) {
						return
					}
					if (d.pointer >= d.keep + d.skip) d.pointer = 0 // restart pointer
				}

				r.lines.push(line)
			}
		})
	} catch (e) {
		if (q.fileIsTruncated && e.includes(utils.SAMTOOLS_ERR_MSG.view)) {
			// expected err with truncated file, ignore
		} else {
			// unexpected err
			throw e
		}
	}
}

/*

'samtools depth' returns single base depth
results are collected in bplst[]
when region resolution is high (>=1 pixels for each bp), bplst[] has one element per basepair;
when region resolution is low with #bp per pixel is above a cutoff e.g. 3,
should summarize into bins, each bin for a pixel with .coverage for each pixel, with one element for each bin in bplst[]

at r.ntwidth>=1:
	get depth at each bp and plot one bar for each bp;
	bplst[] is constructed directly according to the "samtools depth" output
	non-covered basepairs will not show up in bplst
	thus the genomic positions in the array may be *discontinuous*
	and must use coordinate direct match to find in bplst but not "bp seek"
at r.ntwidth<1:
	bin the basepairs under a pixel and plot mean value, one bar for each pixel
	bplst[] is constructed by "bp seek"
	will introduce undefined elements for uncovered regions!!
	must test if bplst[?] is valid before using
*/
async function run_samtools_depth(q, r) {
	const bplst = []
	const args = ['depth']

	if (q.fileIsTruncated) {
	} else {
		args.push('-r')
		args.push((q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + (r.start + 1) + '-' + r.stop)
	}
	args.push('-g')
	args.push('DUP')
	args.push(q.file || q.url)

	// Show/Hide PCR optical duplicates
	if (q.drop_pcrduplicates) {
		args.push('-G')
		args.push('0x400')
	}
	if (q.drop_supplementary_alignments) {
		args.push('-G')
		args.push('0x800')
	}

	try {
		await utils.get_lines_bigfile({
			isbam: true,
			args: args,
			dir: q.dir,
			callback: line => {
				const l = line.split('\t')
				const position = Number.parseInt(l[1]) - 1 // change to 0-based
				const depth = Number.parseInt(l[2])
				if (r.ntwidth >= 1) {
					// zoomed in, one element per basepair
					bplst.push({ position, total: depth })
					return
				}
				// zoomed out, sum all basepairs covered by each pixel
				const bpidx = Math.floor((position - r.start) * r.ntwidth) // array index of bplst
				if (!bplst[bpidx]) {
					bplst[bpidx] = {
						position,
						sum: 0, // temp
						count: 0 // temp
					}
				}
				bplst[bpidx].sum += depth
				bplst[bpidx].count++
			}
		})
	} catch (e) {
		if (q.fileIsTruncated && e.includes(utils.SAMTOOLS_ERR_MSG.view)) {
			// expected err with truncated file, ignore
		} else {
			// unexpected err
			throw e
		}
	}

	if (r.ntwidth < 1) {
		// get average for each bin
		for (const b of bplst) {
			if (!b) continue // could be undefined elements (gaps)
			b.total = b.sum / b.count
			delete b.sum
			delete b.count
		}
	}
	return bplst
}

async function may_checkrefseq4mismatch(templates, q) {
	// requires ntwidth
	// read quality is not parsed yet, so need to set cidx for mismatch box so its quality can be added later
	for (const r of q.regions) {
		if (r.lines.length > 0 && r.ntwidth >= minntwidth_findmismatch) {
			r.to_checkmismatch = true
			r.referenceseq = await get_refseq(q.genome, r.chr + ':' + (r.start + 1) + '-' + r.stop)
		}
	}
	for (const t of templates) {
		for (const segment of t.segments) {
			const r = q.regions[segment.ridx]
			if (!r.to_checkmismatch) continue
			const mismatches = []
			for (const b of segment.boxes) {
				if (b.cidx == undefined) {
					continue
				}
				if (b.opr == 'M') {
					// FIXME only attach b.s if r.to_printnt is true; need to wait for further fix
					b.s = segment.seq.substr(b.cidx, b.len)
					check_mismatch(mismatches, r, b, b.s)
				}
			}
			if (mismatches.length) segment.boxes.push(...mismatches)
		}
	}
	// attr no longer needed
	for (const r of q.regions) {
		delete r.to_checkmismatch
		delete r.referenceseq
	}
}

/*
loaded reads for all regions under q.regions
divide to groups if to match with variant
plot each group into a separate canvas

return {}
  .groups[]
  .refalleleerror
*/
async function divide_reads_togroups(q) {
	const templates_info = []

	const widths = []
	let width = 0

	for (const r of q.regions) {
		for (const line of r.lines) {
			// FIXME to support multi-region
			// q.regions[0] may need to be modified
			templates_info.push({ sam_info: line, tempscore: '' })
		}
		width = r.x + r.width // Storing the extreme right position of every region
		widths.push(width) // Storing widths of regions
	}

	if (templates_info.length == 0) {
		// no reads from any region
		return {
			groups: [
				{
					type: bamcommon.type_all,
					regions: bamcommon.duplicateRegions(q.regions),
					templates: templates_info,
					messages: [],
					partstack: q.partstack,
					widths: widths
				}
			]
		}
	}

	if (q.variant) {
		if (q.regions.length == 1) {
			return await match_complexvariant_rust(q, templates_info, widths)
		} else {
			// Should not happen as indel works only in single region
			console.log('Indel pipeline works only in single region. Please check!')
		}
	}
	if (q.sv && q.regions.length > 1) {
		// For SVs and fusions
		return match_sv(templates_info, q, widths)
	}

	// no variant, return single group
	return {
		groups: [
			{
				type: bamcommon.type_all,
				regions: bamcommon.duplicateRegions(q.regions),
				templates: templates_info,
				messages: [],
				partstack: q.partstack,
				widths: widths
			}
		]
	}
}

async function match_sv(templates, q, region_widths) {
	// TODO templates may not be all in one array?
	const type2group = bamcommon.make_type2group(q)

	// Assuming there are only two regions in an SV/fusion
	const region1_qnames = []
	const region2_qnames = []
	const input_data = []
	for (let i = 0; i < q.regions.length; i++) {
		const r = q.regions[i]
		const region_refseq = (await utils.get_fasta(q.genome, r.chr + ':' + r.start + '-' + r.stop))
			.split('\n')
			.slice(1)
			.join('')
			.toUpperCase()
		const reads_in_current_region = []
		for (const line of r.lines) {
			reads_in_current_region.push({ sam_info: line, tempscore: '', ridx: i })
		}
		const region_data = { refseq: region_refseq, start: r.start, stop: r.stop, entries: reads_in_current_region }
		if (i == 0) {
			region_data.chr = q.sv.chrA
			region_data.pos = q.sv.startA
		} else if (i == 1) {
			region_data.chr = q.sv.chrB
			region_data.pos = q.sv.startB
		} else {
			console.log('More than two regions, please check')
		}
		input_data.push(region_data)
	}
	//console.log('input_data:', input_data)

	const time1 = new Date()
	const rust_output_list = (await run_rust('sv', JSON.stringify(input_data))).split('\n') // Classifying SV reads
	const time2 = new Date()
	console.log('Time taken to run rust SV pipeline:', time2 - time1, 'ms')
	//console.log('rust_output_list:', rust_output_list)

	let multi_region_templates
	let single_region_templates
	for (let item of rust_output_list) {
		if (item.includes('multi_region_templates:')) {
			multi_region_templates = JSON.parse(item.replace('multi_region_templates:', ''))
		} else if (item.includes('single_region_templates:')) {
			single_region_templates = JSON.parse(item.replace('single_region_templates:', ''))
		}
	}
	//console.log('multi_region_templates:', multi_region_templates)
	//console.log('single_region_templates:', single_region_templates)

	if (!q.grouptype || q.grouptype == 'support_sv') {
		for (const item of multi_region_templates) {
			type2group[bamcommon.type_supportsv].templates.push(item)
		}
	}

	if (!q.grouptype || q.grouptype == 'support_ref') {
		for (const item of single_region_templates) {
			type2group[bamcommon.type_supportref].templates.push(item)
		}
	}

	const groups = []
	for (const k in type2group) {
		const g = type2group[k]
		if (g.templates.length == 0) continue // empty group, do not include
		if (k == bamcommon.type_supportsv) {
			if (g.templates.length == 1) {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' read supporting SV/fusion'
				})
			} else {
				g.messages.push({
					isheader: true,
					t: g.templates.length + ' reads supporting SV/fusion'
				})
			}
		} else if (k == bamcommon.type_supportref) {
			g.messages.push({
				isheader: true,
				t: g.templates.length + ' reads supporting reference allele'
			})
		}
		g.widths = region_widths
		groups.push(g)
	}
	return { groups }
}

function get_templates(q, group) {
	// parse reads from all regions
	// returns an array of templates, no matter if paired or not
	if (!q.asPaired) {
		// pretends single reads as templates
		const lst = []

		// XXX XXX XXX !!!!broken logic
		// if 2 regions will parse the same reads twice??
		// .r and .ridx should come from query_reads and this info should not be erased by divide_reads_togroups
		// to be fixed later
		for (let i = 0; i < q.regions.length; i++) {
			const r = q.regions[i]
			for (const line of group.templates) {
				//line.r = r
				line.ridx = i
				const segment = parse_one_segment(line, r, q)
				if (!segment) continue
				lst.push({
					x1: segment.x1,
					x2: segment.x2,
					__tempscore: segment.tempscore,
					segments: [segment]
				})
			}
		}
		return lst
	}
	// paired segments are joined together; a template with segments possibly from multiple regions
	const qname2template = new Map()
	// key: qname
	// value: template, a list of segments
	for (let i = 0; i < q.regions.length; i++) {
		const r = q.regions[i]
		for (const line of group.templates) {
			//line.r = r
			line.ridx = i
			const segment = parse_one_segment(line, r, q)
			if (!segment || !segment.qname) continue
			const temp = qname2template.get(segment.qname)
			if (temp) {
				// add this segment to existing template
				temp.segments.push(segment)
				temp.x2 = Math.max(temp.x2, segment.x2)
			} else {
				qname2template.set(segment.qname, {
					x1: Math.max(segment.x1, r.x),
					x2: Math.min(segment.x2, r.x + r.width),
					__tempscore: segment.tempscore,
					segments: [segment]
				})
			}
		}
	}
	return [...qname2template.values()]
}

/* parse one line of sam to return an object of a segment/read
return undefined if unmapped or invalid data

do not do:
  parse seq
  parse qual
  assign seq & qual to each box
  checking mismatch

only gather boxes in view range, with sequence start (cidx) for finalizing later

may skip insertion if on screen width shorter than minimum width

when seq or cigar is *, will still return segment object for rendering
the returned object may not have any boxes, in that case will render a blank box to mark out the read
*/
function parse_one_segment(arg, r, q) {
	const {
		sam_info, // sam line
		tempscore, // ?
		//r, // region
		ridx, // array index for current region in q.regions[]
		// set following to true when getting details for a read
		keepallboxes, // even if only part of the read is shown in view range
		keepmatepos, // for displaying mate position (on same chr) in details panel
		keepunmappedread // return object if the read is unmapped
	} = arg

	// q is the query object to count number of skipped reads, and is missing for querying single read

	const l = sam_info.trim().split('\t')
	if (l.length < 11) {
		// truncated line possible if the reading process is killed
		return
	}
	const qname = l[0],
		flag = l[2 - 1],
		segstart_1based = Number.parseInt(l[4 - 1]),
		cigarstr = l[6 - 1],
		rnext = l[7 - 1],
		pnext = l[8 - 1],
		tlen = Number.parseInt(l[9 - 1]),
		seq = l[10 - 1], // can be * or =
		qual = l[11 - 1]

	if (Number.isNaN(segstart_1based) || segstart_1based <= 0) {
		// invalid
		return
	}

	const segstart = segstart_1based - 1

	const segment = {
		// return this data structure
		qname,
		segstart,
		segstart_original: segstart, // This is necessary when read starts with a softclip, the segstart field contains the original position - number of softclipped nucleotides. This is necessary for rendering the read , but in the read info panel the original bam file position must be reported.
		segstop: segstart,
		boxes: [], // blank array for no aligned parts
		forward: !(flag & 0x10),
		ridx,
		seq,
		qual,
		cigarstr,
		tlen,
		flag,
		tempscore
	}

	parse_flag_detect_readtype(segment, rnext, pnext, r, keepmatepos, segstart_1based)

	if (flag & 0x4) {
		if (keepunmappedread) {
			segment.boxes.push({
				opr: cigarstr,
				start: segstart,
				len: seq.length,
				cidx: 0,
				qual
			})
			segment.discord_unmapped1 = true
			return segment
		}
		// return undefined so the unmapped read will not render
		// may collect number of unmapped reads in view range and report
		return
	}
	// from here, read is mapped
	if (cigarstr != '*') {
		// has valid cigar string to be parsed
		// as the absolute coord start of each box, will be incremented after parsing a box
		let pos = segstart
		// prev/cum are sequence/qual character offset
		let prev = 0,
			cum = 0

		for (let i = 0; i < cigarstr.length; i++) {
			const cigar = cigarstr[i]
			if (cigar.match(/[0-9]/)) continue
			// read bp length of this part
			const len = Number.parseInt(cigarstr.substring(prev, i))
			if (cigar == 'H') {
				const b = {
					opr: cigar,
					start: pos,
					len,
					cidx: cum - len
				}
				if (segment.boxes.length == 0) {
					// this is the first box, will not consume ref
					// shift hardclip start to left, so its end will be pos, will not increment pos
					b.start -= len
					b.cidx = 0
					if (keepallboxes || Math.max(pos, r.start) <= Math.min(pos + len - 1, r.stop)) {
						segment.boxes.push(b)
					}
				} else {
					// not the first box, so should be the last box
					// do not shift start
					segment.boxes.push(b)
				}
				prev = i + 1
				continue
			}
			if (cigar == 'N') {
				// no seq
			} else if (cigar == 'P' || cigar == 'D') {
				// padding or del, no sequence in read
			} else {
				// will consume read seq
				cum += len
			}
			prev = i + 1
			if (cigar == '=' || cigar == 'M') {
				if (keepallboxes || Math.max(pos, r.start) <= Math.min(pos + len - 1, r.stop)) {
					// visible
					segment.boxes.push({
						opr: cigar,
						start: pos,
						len,
						cidx: cum - len
					})
					// need cidx for = / M, for quality and sequence mismatch
				}
				pos += len
				continue
			}
			if (cigar == 'I') {
				if (keepallboxes || (pos > r.start && pos < r.stop)) {
					if (len * r.ntwidth >= insertion_minpx) {
						segment.boxes.push({
							opr: 'I',
							start: pos,
							len,
							cidx: cum - len
						})
					}
				}
				continue
			}
			if (cigar == 'N' || cigar == 'D') {
				// deletion or skipped region, must have at least one end within region
				// cannot use max(starts)<min(stops)
				// if both ends are outside of region e.g. intron-spanning rna read, will not include
				if (
					(pos >= r.start && pos <= r.stop) ||
					(pos + len - 1 >= r.start && pos + len - 1 <= r.stop) ||
					keepallboxes
				) {
					segment.boxes.push({
						opr: cigar,
						start: pos,
						len
					})
					// no box seq, don't add cidx
				}
				pos += len
				continue
			}
			if (cigar == 'X') {
				if (keepallboxes || Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					const b = {
						opr: cigar,
						start: pos,
						len,
						cidx: cum - len
					}
					segment.boxes.push(b)
				}
				pos += len
				continue
			}
			if (cigar == 'S') {
				const b = {
					opr: cigar,
					start: pos,
					len,
					cidx: cum - len
				}
				if (segment.boxes.length == 0) {
					// this is the first box, will not consume ref
					// shift softclip start to left, so its end will be pos, will not increment pos
					b.start -= len
					if (keepallboxes || Math.max(pos, r.start) <= Math.min(pos + len - 1, r.stop)) {
						segment.boxes.push(b)
					}
				} else {
					// not the first box, so should be the last box
					// do not shift start
					segment.boxes.push(b)
				}
				continue
			}
			if (cigar == 'P') {
				if (keepallboxes || (pos > r.start && pos < r.stop)) {
					const b = {
						opr: 'P',
						start: pos,
						len,
						cidx: cum - len
					}
					segment.boxes.push(b)
				}
				continue
			}
			console.log('unknown cigar: ' + cigar)
		}

		if (segment.boxes.length == 0) {
			// no visible boxes, do not show this segment
			// this is the case for rnaseq reads split across the viewing intron and no need to show
			if (q) q.readcount_skipped++
			return
		}

		segment.segstop = pos
		segment.x1 = r.x + r.scale(segment.boxes[0].start)
		segment.x2 = r.x + r.scale(segmentstop(segment.boxes)) // x stop position, for drawing connect line
	}

	return segment
}

/*
parse flag, detect if read is discordant read
the current read is always mapped (0x4 is false)

will set below boolean flags on segment for rendering:
.isfirst
.islast
.rnext
.pnext (when mate is on different chr)
.discord_orientation

0x2 alone is not enough to tell if the read is discordant or not
*/
function parse_flag_detect_readtype(segment, rnext, pnext, r, keepmatepos, segstart_1based) {
	const f = segment.flag

	if (!(f & 0x1)) {
		// single end
		// no need to parse any other flags?
		return
	}

	// f & 0x4 should always be false (this read is properly mapped)

	if (f & 0x40) {
		segment.isfirst = true
	} else if (f & 0x80) {
		segment.islast = true
	}

	if (rnext != '=' && rnext != '*' && rnext != r.chr) {
		// mate is in different chromosome
		segment.rnext = rnext
		segment.pnext = pnext
		return
	}

	// for rest of cases, read and mate are on same chr
	if (f & 0x8) {
		// mate unmapped
		segment.discord_unmapped2 = true
		return
	}

	// mate is mapped for the rest cases
	// check combination of orientation and insert size status

	if (
		(f & 0x20 && !(f & 0x10) && f & 0x40) || // F1R2
		(f & 0x10 && !(f & 0x20) && f & 0x80) || // F1R2
		(f & 0x10 && !(f & 0x20) && f & 0x40) || // F2R1
		(f & 0x20 && !(f & 0x10) && f & 0x80) // F2R1
	) {
		/******** correct orientation ********/

		if (f & 0x2) {
			// insert size and orientation are both correct, do not set any flags
		} else {
			// wrong insert size
			segment.discord_wrong_insertsize = true
			if (keepmatepos) segment.pnext = pnext // for displaying mate position (on same chr) in details panel
		}
	} else {
		/******** wrong orientation ********/
		segment.discord_orientation = true

		if (keepmatepos) {
			// to display wrong orientation in details panel
			if (f & 0x10) {
				if (f & 0x20) {
					segment.discord_orientation_direction = 'R1R2'
				} else {
					// copies gav's logic
					if (pnext > segstart_1based) {
						//read is on negative strand, mate is on positive strand, but mate position is downstream: <-- -->
						segment.discord_orientation_direction = 'R1F2'
					}
				}
			} else {
				if (f & 0x20) {
					// copies gav's logic
					if (pnext < segstart_1based) {
						//read is on positive strand, mate is on negative strand, but mate position is upstream: <-- -->
						segment.discord_orientation_direction = 'R1F2'
					}
				} else {
					segment.discord_orientation_direction = 'F1F2'
				}
			}
		}

		if (f & 0x2) {
			// insert size correct
		} else {
			// insert size and orientation are both wrong
			segment.discord_wrong_insertsize = true
			if (keepmatepos) segment.pnext = pnext // for displaying mate position (on same chr) in details panel
		}
	}
}

/*
call after stacking
control canvas height based on number of reads and stacks
set rendering parameters in q{}
based on stack height, to know if to render base quality and print letters
return number of stacks for setting canvas height

"templates" is the renderable reads from this group, may be less than group.templates due to skipped ones (intron splicing etc)

super high number of stacks will result in fractional row height and blurry rendering, no way to fix it now
*/
async function poststack_adjustq(group, q, templates) {
	const [a, b] = getstacksizebystacks(group.stacks.length, q)
	group.stackheight = a
	group.stackspace = b
	for (const r of group.regions) {
		r.to_printnt = group.stackheight > 7 && r.ntwidth >= 7
		r.to_qual = r.ntwidth >= minntwidth_toqual
	}
	if (group.stacks.length) {
		// has reads/templates for rendering, support below
		if (group.stackheight >= minstackheight_returntemplatebox && templates.length < max_returntemplatebox) {
			group.returntemplatebox = []
		} else {
			if (!group.partstack) {
				group.allowpartstack = true // to inform client
			}
		}
	}

	// decide if to indicate read strand (clip arrowhead) uniformly for all reads in the group
	if (group.stackheight >= minstackheight2strandarrow) {
		// not too many stacks, can indicate strand
		// NOTE: if bam file contains reads of different length, this method will NOT work
		// must based on length of each read to determine if to clip, but not uniformly the whole group
		let maxwidth = 0
		for (const t of templates) {
			for (const s of t.segments) {
				maxwidth = Math.max(maxwidth, s.x2 - s.x1)
			}
		}
		if (maxwidth > group.stackheight * 0.7) {
			group.canClipArrowhead = true
		}
	}
}

function getstacksizebystacks(numofstacks, q) {
	/* with hardcoded cutoffs
	with 1 or more groups, reduce the max canvas height by half
	 */
	let a = (q.groups.length > 1 ? maxcanvasheight / 2 : maxcanvasheight) / numofstacks
	if (a > 10) return [Math.min(15, Math.floor(a)), 1]
	if (a > 7) return [Math.floor(a), 1]
	if (a > 3) return [Math.ceil(a), 0]
	if (a > 1) return [Math.floor(a), 0]
	return [a, 0]
}

function stack_templates(group, q, templates) {
	// stack by on screen x1 x2 position of each template, only set stack idx to each template
	// actual y position will be set later after stackheight is determined
	// adds q.stacks[]
	// stacking code not reusable for the special spacing calculation
	if (!q.asPaired) {
		// Single read view
		templates.sort((i, j) => i.x1 - j.x1) //group.templates
		group.stacks = [] // each value is screen pixel pos of each stack
		for (let region_idx = 0; region_idx < q.regions.length; region_idx++) {
			for (const template of templates) {
				// group.templates
				if (template.segments[0].ridx == region_idx) {
					let stackidx = null
					if (!q.variant && !q.sv) {
						for (let i = 0; i < group.stacks.length; i++) {
							if (
								group.stacks[i] + q.stacksegspacing < template.x1 &&
								group.stacks[i] + q.stacksegspacing < q.regions[region_idx].x + q.regions[region_idx].width
							) {
								stackidx = i
								group.stacks[i] = template.x2
								break
							}
						}
					}
					if (stackidx == null) {
						stackidx = group.stacks.length
						group.stacks[stackidx] = template.x2
					}
					template.y = stackidx
				}
			}
		}
	} else {
		// Paired end view
		group.stacks = [] // each value is screen pixel pos of each stack
		const single_region_templates = []
		const multi_region_templates = []
		for (const template of templates) {
			let region_idx = template.segments[0].ridx
			// Determine stackable template coordinates template.x1 and template.x2
			if (template.segments.length == 1) {
				template.x1 = Math.max(q.regions[region_idx].x, template.x1)
				template.x2 = Math.min(q.regions[region_idx].x + q.regions[region_idx].width, template.x2)
				single_region_templates.push(template)
			} else if (template.segments.length == 2 && template.segments[0].ridx == template.segments[1].ridx) {
				// Paired end template in same region
				template.x1 = Math.max(q.regions[region_idx].x, template.x1)
				template.x2 = Math.min(q.regions[region_idx].x + q.regions[region_idx].width, template.x2)
				single_region_templates.push(template)
			} else if (template.segments.length == 2 && template.segments[0].ridx != template.segments[1].ridx) {
				//Paired-end template in multiple regions
				template.x1 = template.x1
				template.x2 = template.x2
				multi_region_templates.push(template)
			}
		}
		single_region_templates.sort((i, j) => i.x1 - j.x1) //group.templates
		multi_region_templates.sort((i, j) => i.x1 - j.x1) //group.templates

		if (multi_region_templates.length > 0) {
			const left_templates = []
			const right_templates = []
			const first_multi_region_template = multi_region_templates[0]
			for (const template of single_region_templates) {
				if (template.x1 < first_multi_region_template.x1) {
					if (template.x2 < first_multi_region_template.x1) {
						left_templates.push(template)
					} else {
						right_templates.push(template)
					}
				} else {
					right_templates.push(template)
				}
			}
			templates = [...left_templates, ...multi_region_templates, ...right_templates]
		}

		//templates.sort((i, j) => i.x1 - j.x1) //group.templates
		for (const template of templates) {
			let region_idx = template.segments[0].ridx
			//console.log('q.regions[region_idx].x:', q.regions[region_idx].x)
			//console.log('q.regions[region_idx].width:', q.regions[region_idx].x + q.regions[region_idx].width)
			//console.log('template.qname:', template.segments[0].qname)
			//console.log('template.x1:', template.x1)
			//console.log('template.x2:', template.x2)
			//console.log('template.segments[0].ridx:', template.segments[0].ridx)
			//if (template.segments.length == 2) {
			//	console.log('template.segments[1].ridx:', template.segments[1].ridx)
			//}

			// group.templates
			let stackidx = null
			if (!q.variant) {
				for (let i = 0; i < group.stacks.length; i++) {
					if (template.x2 == q.regions[region_idx].x + q.regions[region_idx].width && group.stacks[i] < template.x1) {
						stackidx = i
						group.stacks[i] = template.x2
						break
					} else if (group.stacks[i] + q.stacksegspacing < template.x1) {
						stackidx = i
						group.stacks[i] = template.x2
						break
					}
				}
			}
			if (stackidx == null) {
				stackidx = group.stacks.length
				group.stacks[stackidx] = template.x2
			}
			template.y = stackidx
		}
	}
	templates = may_trimstacks(group, templates, q)
	return templates
}

function may_trimstacks(group, templates, q) {
	if (!group.partstack) return templates
	// should be a positive integer
	const lst = templates.filter(i => i.y >= group.partstack.start && i.y <= group.partstack.stop) //group.
	lst.forEach(i => (i.y -= group.partstack.start))
	//group.templates = lst
	templates = lst
	group.stacks = []
	//console.log('templates:', templates)
	for (let i = group.partstack.start; i <= group.partstack.stop; i++) {
		group.stacks.push(0)
	}
	group.returntemplatebox = [] // always set this
	return templates
}

async function get_refseq(g, coord) {
	const tmp = await utils.get_fasta(g, coord)
	const l = tmp.split('\n')
	l.shift()
	return l.join('').toUpperCase()
}

function finalize_templates(group, templates, q) {
	/*
for each template:
	for each box:
	  the box alreay has raw strings for .seq and .qual
	  may do below:
		add sequence
		add quality
at the end, set q.canvasheight
	*/
	const stacky = get_stacky(group, templates, q)
	for (const template of templates) {
		// group.templates
		template.y = stacky[template.y]
		for (const segment of template.segments) {
			const r = group.regions[segment.ridx]
			const quallst = r.to_qual ? qual2int(segment.qual) : null
			for (const b of segment.boxes) {
				if (b.cidx == undefined || b.opr == 'H') {
					continue
				}
				if (quallst) {
					b.qual = quallst.slice(b.cidx, b.cidx + b.len)
				}
				if (b.opr == 'I') {
					// insertion has been decided to be visible so always get seq
					b.s = segment.seq.substr(b.cidx, b.len)
				} else if (b.opr == 'X' || b.opr == 'S') {
					//if (r.to_printnt) {
					b.s = segment.seq.substr(b.cidx, b.len)
					//}
				}
				delete b.cidx
			}
			delete segment.seq
			delete segment.qual
		}
	}
}

function qual2int(s) {
	if (s == '*') return null
	const lst = []
	for (let i = 0; i < s.length; i++) {
		const v = s[i].charCodeAt(0) - 33
		lst.push(v)
	}
	return lst
}

function get_stacky(group, templates, q) {
	// get y off for each stack, may account for fat rows created by overlapping read pairs
	const stackrowheight = []
	for (let i = 0; i < group.stacks.length; i++) stackrowheight.push(group.stackheight)
	overlapRP_setflag(group, q)
	if (group.overlapRP_multirows) {
		// expand row height for stacks with overlapping read pairs
		for (const template of templates) {
			//group.templates
			if (template.segments.length <= 1 || template.segments[0].ridx != template.segments[1].ridx) continue // It is not a good idea to hardcode templates in multiple regions to not have overlap. It is possible when their is a common region between the two regions. Will need better logic later which checks for common regions
			template.height = getrowheight_template_overlapread(template, group.stackheight)
			stackrowheight[template.y] = Math.max(stackrowheight[template.y], template.height)
		}
	}

	const stacky = []
	let y = group.stackspace
	for (const h of stackrowheight) {
		stacky.push(y)
		y += h + group.stackspace
	}
	group.canvasheight = y
	return stacky
}

function overlapRP_setflag(group, q) {
	if (!q.asPaired) return
	for (const r of group.regions) {
		if (r.ntwidth <= minntwidth_overlapRPmultirows) return
	}
	group.overlapRP_multirows = true
	group.overlapRP_hlline = group.stackspace > 0
}

function getrowheight_template_overlapread(template, stackheight) {
	// if to show overlapped read pairs, detect if this template has overlap, if so, double the row height
	if (template.segments.length == 2) {
		const [a, b] = template.segments
		if (a.x2 > b.x1) {
			b.shiftdownrow = 1 // shift down by 1 row
			return stackheight * 2
		}
		return stackheight
	}
	// more than 2 segments, do a mini stack to, may not happen??
	console.log('more than 2 segments', template.segments.length)
	const stacks = []
	for (const b of template.segments) {
		let stackidx = null
		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] < b.x1) {
				stackidx = i
				stacks[i] = b.x2
				break
			}
		}
		if (stackidx == null) {
			stackidx = stacks.length
			stacks[stackidx] = b.x2
		}
		b.shiftdownrow = stackidx
	}
	return stackheight * stacks.length
}

function segmentstop(boxes) {
	return Math.max(...boxes.map(i => i.start + i.len))
}

function check_mismatch(lst, r, box, boxseq) {
	// only work on M box
	for (let i = 0; i < boxseq.length; i++) {
		if (box.start + i < r.start || box.start + i > r.stop) {
			// to skip bases beyond view range
			continue
		}
		const readnt = boxseq[i]
		const refnt = r.referenceseq[box.start + i - r.start]
		if (refnt != readnt.toUpperCase()) {
			const b = {
				opr: 'X', // mismatch
				start: box.start + i,
				len: 1,
				s: readnt,
				cidx: box.cidx + i
			}
			lst.push(b)
		}
	}
}

function plot_template(ctx, template, group, q) {
	if (group.returntemplatebox) {
		// one box per template
		const r = group.regions[template.segments[0].ridx] // this region where the segment falls into
		r.width = group.widths[template.segments[0].ridx]
		let box
		if (!q.asPaired) {
			// single reads are in multiple "templates", tell if its first/last to identify
			box = {
				qname: template.segments[0].qname,
				x1: Math.max(r.x, template.x1),
				x2: Math.min(template.x2, r.x + r.width),
				y1: template.y,
				y2: template.y + (template.height || group.stackheight),
				start: Math.min(...template.segments.map(i => i.segstart)),
				stop: Math.max(...template.segments.map(i => i.segstop))
			}

			if (template.segments[0].isfirst) box.isfirst = true
			if (template.segments[0].islast) box.islast = true
		} else {
			// In paired end mode
			if (template.segments.length == 2) {
				if (template.segments[0].ridx != template.segments[1].ridx) {
					// When read pairs are discordant expanding past expected insert size and possibly in different chromosomes altogether
					box = {
						qname: template.segments[0].qname,
						x1: template.x1,
						x2: template.x2,
						y1: template.y,
						y2: template.y + (template.height || group.stackheight),
						start: Math.min(...template.segments.map(i => i.segstart)),
						stop: Math.max(...template.segments.map(i => i.segstop)),
						multi_region: true
					}
				} else {
					box = {
						qname: template.segments[0].qname,
						x1: Math.max(r.x, template.x1),
						x2: Math.min(template.x2, r.width),
						y1: template.y,
						y2: template.y + (template.height || group.stackheight),
						start: Math.min(...template.segments.map(i => i.segstart)),
						stop: Math.max(...template.segments.map(i => i.segstop))
					}
				}
			} else {
				// When template contains a single segment
				const seg = template.segments[0]
				const r = group.regions[seg.ridx]
				r.width = group.widths[seg.ridx]
				box = {
					qname: template.segments[0].qname,
					x1: Math.max(r.x, template.x1),
					x2: Math.min(template.x2, r.width),
					y1: template.y,
					y2: template.y + (template.height || group.stackheight),
					start: Math.min(...template.segments.map(i => i.segstart)),
					stop: Math.max(...template.segments.map(i => i.segstop))
				}
			}
		}
		group.returntemplatebox.push(box)
	}
	for (let i = 0; i < template.segments.length; i++) {
		const seg = template.segments[i]
		const r = group.regions[seg.ridx]
		r.width = group.widths[seg.ridx]
		if (i == 0) {
			// is the first segment, same rendering method no matter in single or paired mode
			plot_segment(ctx, seg, template.y, group, q)
			continue
		}
		// after the first segment, this only occurs in paired mode
		const prevseg = template.segments[i - 1]
		const prev_r = group.regions[prevseg.ridx]
		prev_r.width = group.widths[prevseg.ridx]
		if (prevseg.x2 <= seg.x1 || template.segments[0].ridx != template.segments[1].ridx) {
			// It is not a good idea to hardcode templates in multiple regions to not have overlap. It is possible when their is a common region between the two regions. Will need better logic which takes into account possibility of common region.
			// two segments are apart; render this segment the same way, draw dashed line connecting with last
			plot_segment(ctx, seg, template.y, group, q)
			const y = Math.floor(template.y + group.stackheight / 2) + 0.5
			ctx.strokeStyle = group.stackheight <= 2 ? split_linecolorfaint : match_hq
			ctx.setLineDash([5, 3]) // dash for read pairs
			ctx.beginPath()
			if (prev_r.x == r.x) {
				// Check if both segments are in the same region
				ctx.moveTo(prevseg.x2, y)
				ctx.lineTo(seg.x1, y)
			} else if (prev_r.x < prevseg.x2 && seg.x1 < r.width) {
				ctx.moveTo(Math.min(prevseg.x2, prev_r.width), y)
				ctx.lineTo(Math.max(seg.x1, r.x), y)
			}
			ctx.stroke()

			if (group.overlapRP_hlline) {
				// highlight line is showing, this is at zoom in level
				// detect if two segments are next to each other, by coord but not x1/2
				// as at zoom out level, pixel position is imprecise
				const prevlastbox = prevseg.boxes.reduce((i, j) => {
					if (i.start + i.len > j.start + j.len) return i
					return j
				})
				if (prevlastbox.start + prevlastbox.len == seg.boxes[0].start) {
					ctx.strokeStyle = overlapreadhlcolor
					ctx.setLineDash([])
					ctx.beginPath()
					const x = Math.floor(seg.x1) + 0.5
					ctx.moveTo(x, template.y)
					ctx.lineTo(x, template.y + group.stackheight)
					ctx.stroke()
				}
			}
		} else {
			// overlaps with the previous segment

			if (group.overlapRP_multirows) {
				plot_segment(ctx, seg, template.y + group.stackheight, group, q)
				if (group.overlapRP_hlline) {
					const y = Math.floor(template.y + group.stackheight) + 0.5
					ctx.strokeStyle = overlapreadhlcolor
					ctx.setLineDash([])
					ctx.beginPath()
					if (prev_r.x <= prevseg.x2 && seg.x1 <= r.width) {
						ctx.moveTo(Math.max(seg.x1, r.x), y)
						ctx.lineTo(Math.min(prevseg.x2, prev_r.width), y)
					}
					ctx.stroke()
				}
			} else {
				plot_segment(ctx, seg, template.y, group, q)
			}
		}
	}

	// for testing, print a stat (numeric or string) per template on the right of each row
	// should not use this in production
	if (template.__tempscore != undefined && serverconfig.features.indel_read_alignment_scores) {
		ctx.fillStyle = 'blue'
		ctx.font = group.stackheight + 'pt Arial'
		ctx.fillText(template.__tempscore, q.regions[0].width - 100, template.y + group.stackheight / 2)
	}
}

function plot_segment(ctx, segment, y, group, q) {
	const r = group.regions[segment.ridx] // this region where the segment falls into
	// what if segment spans multiple regions
	// a box is always within a region, so get r at box level
	r.width = group.widths[segment.ridx]
	for (const b of segment.boxes) {
		const x = r.x + r.scale(b.start)
		if (b.opr == 'P') continue // do not handle
		if (b.opr == 'I') continue // do it next round
		if (b.opr == 'H') {
			// box with maybe letters
			// not using quality or there ain't such data
			ctx.fillStyle = 'white'
			if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && r.x < x) {
				ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, group.stackheight)
			} else if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && r.x >= x) {
				ctx.fillRect(r.x, y, b.len * r.ntwidth + ntboxwidthincrement + x - r.x, group.stackheight)
			} else if (x + b.len * r.ntwidth + ntboxwidthincrement <= r.width && r.x < x) {
				ctx.fillRect(x, y, r.width - x, group.stackheight)
			}
			continue
		}
		if (b.opr == 'D' || b.opr == 'N') {
			// a line
			if (b.opr == 'D') {
				ctx.strokeStyle = deletion_linecolor
			} else {
				ctx.strokeStyle = group.stackheight <= 2 ? split_linecolorfaint : match_hq
			}
			ctx.setLineDash([]) // use solid lines
			const y2 = Math.floor(y + group.stackheight / 2) + 0.5
			ctx.beginPath()
			ctx.moveTo(Math.max(x, r.x), y2)
			ctx.lineTo(Math.min(x + b.len * r.ntwidth, r.x + r.width), y2)
			ctx.stroke()
			if (group.stackheight > minstackheight2printbplenDN) {
				// b boundaries may be out of range
				const x1 = Math.max(r.x, x)
				const x2 = Math.min(r.x + r.width, x + b.len * r.ntwidth)
				if (x2 - x1 >= 50) {
					const fontsize = Math.min(maxfontsize2printbplenDN, Math.max(minfontsize2printbplenDN, group.stackheight - 2))
					ctx.font = fontsize + 'pt Arial'
					const tw = ctx.measureText(b.len + ' bp').width
					if (tw < x2 - x1 - 20) {
						ctx.fillStyle = 'white'
						if ((x2 + x1) / 2 + tw / 2 < r.width && r.x < (x2 + x1) / 2 - tw / 2) {
							ctx.fillRect((x2 + x1) / 2 - tw / 2, y, tw, group.stackheight)
							ctx.fillStyle = match_hq
							ctx.fillText(b.len + ' bp', (x2 + x1) / 2, y + group.stackheight / 2)
						} else if ((x2 + x1) / 2 + tw / 2 < r.width && r.x >= (x2 + x1) / 2 - tw / 2) {
							ctx.fillRect(r.x, y, tw + (x2 + x1) / 2 - tw / 2 - r.x, group.stackheight)
							ctx.fillStyle = match_hq
							ctx.fillText(b.len + ' bp', (x2 + x1) / 2, y + group.stackheight / 2)
						} else if ((x2 + x1) / 2 + tw / 2 >= r.width && r.x < (x2 + x1) / 2 - tw / 2) {
							ctx.fillRect((x2 + x1) / 2 - tw / 2, y, r.width - (x2 + x1) / 2 + tw / 2, group.stackheight)
							ctx.fillStyle = match_hq
							ctx.fillText(b.len + ' bp', (x2 + x1) / 2, y + group.stackheight / 2)
						}
					}
				}
			}
			continue
		}

		if (b.opr == '*') {
			// Possibly unmapped reads
			if (r.to_qual && b.qual) {
				let xoff = x
				b.qual.forEach(v => {
					if (segment.discord_unmapped2) {
						ctx.fillStyle = qual2discord_unmapped(v / maxqual)
					}
					ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					xoff += r.ntwidth
				})
			} else {
				// not showing qual, one box
				if (segment.discord_unmapped2) {
					ctx.fillStyle = discord_unmapped_hq
				}
				ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, group.stackheight)
			}

			if (r.to_printnt) {
				ctx.font = Math.min(r.ntwidth, group.stackheight - 2) + 'pt Arial'
			}
			continue
		}
		if (b.opr == 'X' || b.opr == 'S') {
			// box with maybe letters
			if (r.to_qual && b.qual) {
				// to show quality and indeed there is quality
				if (r.to_printnt) {
					ctx.font = Math.min(r.ntwidth, group.stackheight - 2) + 'pt Arial'
				}
				let xoff = x
				for (let i = 0; i < b.qual.length; i++) {
					const v = b.qual[i] / maxqual
					ctx.fillStyle = b.opr == 'S' ? qual2softclipbg(v) : qual2mismatchbg(v)
					//if (xoff + r.ntwidth + ntboxwidthincrement < r.width && xoff <= r.width && r.x < xoff) {
					//	ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					//} else if (xoff < r.width && xoff + r.ntwidth + ntboxwidthincrement >= r.width && r.x < xoff) {
					//	ctx.fillRect(xoff, y, r.width - xoff, group.stackheight)
					//} else if (xoff + r.ntwidth + ntboxwidthincrement > r.x && xoff <= r.x) {
					//	ctx.fillRect(r.x, y, xoff + r.ntwidth + ntboxwidthincrement, group.stackheight)
					//} else if (xoff + r.ntwidth + ntboxwidthincrement < r.width && xoff > r.x) {
					//	ctx.fillRect(xoff, y, xoff + r.ntwidth + ntboxwidthincrement, group.stackheight)
					//}

					if (xoff + r.ntwidth + ntboxwidthincrement < r.x + r.width && r.x <= xoff) {
						ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					} else if (xoff < r.x + r.width && xoff + r.ntwidth + ntboxwidthincrement >= r.x + r.width && r.x <= xoff) {
						ctx.fillRect(xoff, y, r.width + r.x - xoff, group.stackheight)
					} else if (xoff <= r.x && xoff + r.ntwidth + ntboxwidthincrement > r.x) {
						ctx.fillRect(r.x, y, r.ntwidth + ntboxwidthincrement + xoff - r.x, group.stackheight)
					}
					if (r.to_printnt) {
						if (!b.qual) {
							// When quality scores are not defined print nucleotides in black
							ctx.fillStyle = 'black'
						} else {
							ctx.fillStyle = 'white'
						}
						if (xoff + r.ntwidth / 2 < r.width && xoff < r.width && r.x <= xoff + r.ntwidth / 2) {
							ctx.fillText(b.s[i], xoff + r.ntwidth / 2, y + group.stackheight / 2)
						}
					}
					xoff += r.ntwidth
				}
			} else {
				// not using quality or there ain't such data
				ctx.fillStyle = b.opr == 'S' ? softclipbg_hq : mismatchbg_hq
				if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && r.x < x) {
					ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && r.x >= x) {
					ctx.fillRect(r.x, y, b.len * r.ntwidth + ntboxwidthincrement + x - r.x, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement <= r.width && r.x < x) {
					ctx.fillRect(x, y, r.width - x, group.stackheight)
				}
				if (r.to_printnt && !b.qual) {
					ctx.font = Math.min(r.ntwidth, group.stackheight - 2) + 'pt Arial'
					if (!b.qual) {
						// When quality scores are not defined print nucleotides in black
						ctx.fillStyle = 'black'
					} else {
						ctx.fillStyle = 'white'
					}
					for (let i = 0; i < b.s.length; i++) {
						if (x + r.ntwidth * (i + 0.5) < r.width && x < r.width && r.x <= x + r.ntwidth * (i + 0.5)) {
							ctx.fillText(b.s[i], x + r.ntwidth * (i + 0.5), y + group.stackheight / 2)
						}
					}
				}
			}
			continue
		}
		if (b.opr == 'M' || b.opr == '=') {
			// box
			if (r.to_qual && b.qual) {
				let xoff = x
				b.qual.forEach(v => {
					if (segment.rnext) {
						ctx.fillStyle = qual2ctxpair(v / maxqual)
					} else if (segment.discord_orientation) {
						ctx.fillStyle = qual2discord_orientation(v / maxqual)
					} else if (segment.discord_wrong_insertsize) {
						ctx.fillStyle = qual2discord_wrong_insertsize(v / maxqual)
					} else if (segment.discord_unmapped2) {
						ctx.fillStyle = qual2discord_unmapped(v / maxqual)
					} else {
						ctx.fillStyle = qual2match(v / maxqual)
					}
					if (xoff + r.ntwidth + ntboxwidthincrement < r.width && r.x <= xoff) {
						ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					} else if (xoff < r.width && xoff + r.ntwidth + ntboxwidthincrement >= r.width && r.x <= xoff) {
						ctx.fillRect(xoff, y, r.width - xoff, group.stackheight)
					} else if (xoff <= r.x && xoff + r.ntwidth + ntboxwidthincrement > r.x) {
						ctx.fillRect(r.x, y, r.ntwidth + ntboxwidthincrement + xoff - r.x, group.stackheight)
					}
					xoff += r.ntwidth
				})
			} else {
				// not showing qual, one box
				if (b.qual) {
					if (segment.rnext) {
						ctx.fillStyle = ctxpair_hq
					} else if (segment.discord_orientation) {
						ctx.fillStyle = discord_orientation_hq
					} else if (segment.discord_wrong_insertsize) {
						ctx.fillStyle = discord_wrong_insertsize_hq
					} else if (segment.discord_unmapped2) {
						ctx.fillStyle = discord_unmapped_hq
					} else {
						ctx.fillStyle = match_hq
					}
				} else if (r.to_printnt) {
					ctx.fillStyle = 'white'
				} else {
					if (segment.rnext) {
						ctx.fillStyle = ctxpair_hq
					} else if (segment.discord_orientation) {
						ctx.fillStyle = discord_orientation_hq
					} else if (segment.discord_wrong_insertsize) {
						ctx.fillStyle = discord_wrong_insertsize_hq
					} else if (segment.discord_unmapped2) {
						ctx.fillStyle = discord_unmapped_hq
					} else {
						ctx.fillStyle = match_hq
					}
				}
				if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && x < r.width && r.x < x + ntboxwidthincrement) {
					ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && r.x >= x) {
					ctx.fillRect(r.x, y, b.len * r.ntwidth + ntboxwidthincrement + x - r.x, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement >= r.width && r.x < x) {
					ctx.fillRect(x, y, r.width - x, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement >= r.width && r.x >= x) {
					ctx.fillRect(r.x, y, r.width - x, group.stackheight)
				}
			}
			if (r.to_printnt) {
				ctx.font = Math.min(r.ntwidth, group.stackheight - 2) + 'pt Arial'
				if (!b.qual) {
					// When quality scores are not defined print nucleotides in black
					ctx.fillStyle = 'black'
				} else {
					ctx.fillStyle = 'white'
				}
				for (let i = 0; i < b.s.length; i++) {
					if (x + r.ntwidth * (i + 0.5) < r.width && x < r.width && r.x <= x + r.ntwidth * (i + 0.5)) {
						ctx.fillText(b.s[i], x + r.ntwidth * (i + 0.5), y + group.stackheight / 2)
					}
				}
			}
			continue
		}
		throw 'unknown opr at rendering: ' + b.opr
	}
	mayClipArrowhead(ctx, segment, group, r, y)

	if (segment.rnext) {
		// mate is in different chr
		if (!r.to_qual) {
			// no quality and just a solid box, may print mate chr name
			if (segment.x2 - segment.x1 >= 20 && group.stackheight >= 7) {
				ctx.font = Math.min(insertion_maxfontsize, Math.max(insertion_minfontsize, group.stackheight - 4)) + 'pt Arial'
				ctx.fillStyle = 'white'
				ctx.fillText(
					(q.nochr ? 'chr' : '') + segment.rnext,
					(segment.x1 + segment.x2) / 2,
					y + group.stackheight / 2,
					segment.x2 - segment.x1
				)
			}
		}
	}
}

function mayClipArrowhead(ctx, segment, group, r, y) {
	/* render white triangles on one end of segment for the effect of "arrowhead" to indicate strand
	decide if to clip based on on-screen width of each segment

	current method uniformly determines if to clip for all reads in the group
	assumption is reads are of same length

	but for bam with different read lengths, it has to decide based on width of each read
	thus leaving for current method
	*/

	if (!group.canClipArrowhead) return
	if (segment.x2 - segment.x1 < 5) {
		// in case the read is only half-shown in the region
		return
	}

	if (segment.forward) {
		const x = Math.ceil(segment.x2 + ntboxwidthincrement)
		if (x <= r.width + group.stackheight / 2) {
			ctx.fillStyle = 'white'
			ctx.beginPath()
			ctx.moveTo(x - group.stackheight / 2, y)
			ctx.lineTo(x, y)
			ctx.lineTo(x, y + group.stackheight / 2)
			ctx.lineTo(x - group.stackheight / 2, y)
			ctx.closePath()
			ctx.fill()
			ctx.beginPath()
			ctx.moveTo(x - group.stackheight / 2, y + group.stackheight)
			ctx.lineTo(x, y + group.stackheight)
			ctx.lineTo(x, y + group.stackheight / 2)
			ctx.lineTo(x - group.stackheight / 2, y + group.stackheight)
			ctx.closePath()
			ctx.fill()
		}
	} else {
		const x = segment.x1
		if (x >= r.x) {
			ctx.fillStyle = 'white'
			ctx.beginPath()
			ctx.moveTo(x + group.stackheight / 2, y)
			ctx.lineTo(x, y)
			ctx.lineTo(x, y + group.stackheight / 2)
			ctx.lineTo(x + group.stackheight / 2, y)
			ctx.closePath()
			ctx.fill()
			ctx.beginPath()
			ctx.moveTo(x + group.stackheight / 2, y + group.stackheight)
			ctx.lineTo(x, y + group.stackheight)
			ctx.lineTo(x, y + group.stackheight / 2)
			ctx.lineTo(x + group.stackheight / 2, y + group.stackheight)
			ctx.closePath()
			ctx.fill()
		}
	}
}

function plot_insertions(ctx, group, q, templates) {
	/*
after all template boxes are drawn, mark out insertions on top of that by cyan text labels
if single basepair, use the nt; else, use # of nt
if b.qual is available, set text color based on it
*/
	for (const [ridx, r] of group.regions.entries()) {
		if (!r.to_printnt) continue
		// matched nucleotides are shown as white letters in this region
		// before plotting any insertions, to better identify insertions (also white)
		// find out all insertion positions
		const xpos = new Set()
		for (const template of templates) {
			// group.templates
			for (const segment of template.segments) {
				if (segment.ridx != ridx) continue
				const insertions = segment.boxes.filter(i => i.opr == 'I')
				if (!insertions.length) continue
				for (const b of insertions) {
					xpos.add(r.x + r.scale(b.start))
				}
			}
		}
		/*
		// plot a black v line under each position
		ctx.strokeStyle = insertion_vlinecolor
		for (const x of xpos) {
			ctx.beginPath()
			ctx.moveTo(x, 0)
			ctx.lineTo(x, group.canvasheight)
			ctx.stroke()
		}
		*/
	}

	for (const template of templates) {
		//group.templates
		for (const segment of template.segments) {
			const r = group.regions[segment.ridx]
			const insertions = segment.boxes.filter(i => i.opr == 'I')
			if (!insertions.length) continue
			ctx.font = Math.max(insertion_maxfontsize, group.stackheight - 2) + 'pt Arial'
			for (const b of insertions) {
				const x = r.x + r.scale(b.start)
				if (b.qual) {
					ctx.fillStyle = qual2insertion(b.qual.reduce((i, j) => i + j, 0) / b.qual.length / maxqual)
				} else {
					ctx.fillStyle = insertion_hq
				}
				let text
				if (b.s == '') {
					// When sequence read is missing extract length of insertion from the CIGAR sequence
					text = b.len
				} else {
					text = b.s.length == 1 ? b.s : b.s.length
				}
				// text y position to observe if the read is in an overlapping pair and shifted down
				ctx.fillText(text, x, template.y + group.stackheight * (segment.on2ndrow || 0) + group.stackheight / 2)
			}
		}
	}
}

function getcolorscale(q) {
	/*
           base quality
           40  30  20  10  0
           |   |   |   |   |
Match      BBBBBBBBBBBBBBBBB
Mismatch   BBBBBBBBBBBBBBBBB
Softclip   BBBBBBBBBBBBBBBBB
Insertion  BBBBBBBBBBBBBBBBB
*/
	const barwidth = 160,
		barheight = 20,
		barspace = 1,
		fontsize = 12,
		labyspace = 5,
		leftpad = 100,
		rightpad = 10,
		ticksize = 4

	const imgWidth = leftpad + barwidth + rightpad,
		imgHeight = fontsize * 2 + labyspace + ticksize + (barheight + barspace) * 4
	const canvas = createCanvas(q.devicePixelRatio * imgWidth, q.devicePixelRatio * imgHeight)
	const ctx = canvas.getContext('2d')
	if (q.devicePixelRatio > 1) {
		ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
	}

	ctx.fillStyle = 'black'
	ctx.font = fontsize + 'pt Arial'
	ctx.textAlign = 'center'
	ctx.fillText('Base quality', leftpad + barwidth / 2, fontsize)

	let y = fontsize * 2 + labyspace

	ctx.strokeStyle = 'black'
	ctx.beginPath()
	ctx.moveTo(leftpad, y)
	ctx.lineTo(leftpad, y + ticksize)
	ctx.moveTo(leftpad + barwidth / 4, y)
	ctx.lineTo(leftpad + barwidth / 4, y + ticksize)
	ctx.moveTo(leftpad + barwidth / 2, y)
	ctx.lineTo(leftpad + barwidth / 2, y + ticksize)
	ctx.moveTo(leftpad + (barwidth * 3) / 4, y)
	ctx.lineTo(leftpad + (barwidth * 3) / 4, y + ticksize)
	ctx.moveTo(leftpad + barwidth, y)
	ctx.lineTo(leftpad + barwidth, y + ticksize)
	ctx.closePath()
	ctx.stroke()

	ctx.fillText(40, leftpad, y)
	ctx.fillText(30, leftpad + barwidth / 4, y)
	ctx.fillText(20, leftpad + barwidth / 2, y)
	ctx.fillText(10, leftpad + (barwidth * 3) / 4, y)
	ctx.fillText(0, leftpad + barwidth, y)

	ctx.textAlign = 'left'
	ctx.textBaseline = 'middle'

	y += ticksize

	ctx.fillText('Match', 0, y + barheight / 2)
	fillgradient(match_lq, match_hq, y)
	y += barheight + barspace

	ctx.fillStyle = 'black'
	ctx.fillText('Mismatch', 0, y + barheight / 2)
	fillgradient(mismatchbg_lq, mismatchbg_hq, y)
	y += barheight + barspace

	ctx.fillStyle = 'black'
	ctx.fillText('Softclip', 0, y + barheight / 2)
	fillgradient(softclipbg_lq, softclipbg_hq, y)
	y += barheight + barspace

	ctx.fillStyle = 'black'
	ctx.fillText('Insertion', 0, y + barheight / 2)
	fillgradient(insertion_lq, insertion_hq, y)

	function fillgradient(lowq, highq, y) {
		const x = leftpad
		const gradient = ctx.createLinearGradient(x, y, x + barwidth, y)
		gradient.addColorStop(0, highq)
		gradient.addColorStop(1, lowq)
		ctx.fillStyle = gradient
		ctx.fillRect(x, y, barwidth, barheight)
	}

	return { width: imgWidth, height: imgHeight, src: canvas.toDataURL() }
}

////////////////////// get one read/template

async function route_getread(genome, req) {
	// cannot use the point position under cursor to query, as if clicking on softclip
	if (!req.query.chr) throw '.chr missing'
	if (!req.query.qname) throw '.qname missing'
	req.query.qname = decodeURIComponent(req.query.qname) // convert %2B to +
	if (!Number.isInteger(req.query.start)) throw '.start is not integer'
	if (!Number.isInteger(req.query.stop)) throw '.stop is not integer'
	const r = {
		chr: req.query.chr,
		start: req.query.start,
		stop: req.query.stop,
		scale: () => {}, // dummy
		ntwidth: 10 // good to show all insertions
	}
	const seglst = await query_oneread(req, r)
	if (!seglst) {
		// no read found
		if (req.query.show_unmapped) {
			// asking to get an unmapped read. if using a bam slice, the unmapped read could be out of range
			throw 'mate not found'
		}
		throw 'read not found'
	}
	const lst = []
	for (const s of seglst) {
		if (s.discord_unmapped1) {
			// Invoked when the read itself is unmapped
			lst.push(await convertunmappedread2html(s, genome, req.query))
		} else {
			lst.push(await convertread2html(s, genome, req.query))
		}
	}
	if (seglst.alignments) {
		lst[0].alignments = seglst.alignments
	}
	return { lst }
}

async function query_oneread(req, r) {
	const [_file, dir] = await getFilefullpathOrUrl(req)
	const fileIsTruncated = await samtoolsQuickcheck(_file)
	let firstseg, lastseg, readstart, readstop, lst // array of reads to be returned

	if (req.query.unknownorder) {
		// unknown order, read start/stop must be provided
		if (!Number.isInteger(req.query.readstart) || !Number.isInteger(req.query.readstop))
			throw 'readstart/stop not provided for read with unknown order'
		readstart = req.query.readstart
		readstop = req.query.readstop
	}

	const args = ['view', _file]
	if (!fileIsTruncated)
		args.push((req.query.nochr ? req.query.chr.replace('chr', '') : req.query.chr) + ':' + r.start + '-' + r.stop)

	try {
		await utils.get_lines_bigfile({
			isbam: true,
			args,
			dir,
			callback: (line, ps) => {
				if (line.split('\t')[0] != req.query.qname) return
				const s = parse_one_segment(
					{ sam_info: line, keepallboxes: true, keepmatepos: true, keepunmappedread: true },
					r
				)
				if (!s) return
				if (req.query.show_unmapped && s.discord_unmapped2) return // Make sure the read being parse is mapped, especially in cases where the umapped mate is missing
				if (
					(req.query.start != s.segstart_original || req.query.stop != s.segstop) &&
					!req.query.paired &&
					!req.query.show_unmapped
				)
					return
				if (req.query.show_unmapped && req.query.getfirst) {
					// In case first read is mapped and second unmapped
					if (s.islast) {
						ps.kill()
						lst = [s]
						return
					}
				} else if (req.query.show_unmapped && req.query.getlast) {
					// In case first read is mapped and second unmapped
					if (s.isfirst) {
						ps.kill()
						lst = [s]
						return
					}
				} else if (req.query.getfirst) {
					if (s.isfirst) {
						ps.kill()
						lst = [s]
						return
					}
				} else if (req.query.getlast) {
					if (s.islast) {
						ps.kill()
						lst = [s]
						return
					}
				} else if (req.query.unknownorder) {
					if (s.segstart == readstart && s.segstop == readstop) {
						ps.kill()
						lst = [s]
						return
					}
				} else {
					// get both
					if (s.isfirst) firstseg = s
					else if (s.islast) lastseg = s
					if (firstseg && lastseg) {
						ps.kill()
						lst = [firstseg, lastseg]
						return
					}
				}
			}
		})
	} catch (e) {
		if (fileIsTruncated && e.includes(utils.SAMTOOLS_ERR_MSG.view)) {
			// expected err with truncated file, ignore
		} else {
			// unexpected err
			throw e
		}
	}

	if (lst) {
		// Aligning sequence against alternate sequence when altseq is present (when q.variant is true)
		if (req.query.altseqs) {
			const input_data = {
				query_seq: lst[0].seq,
				refseqs: req.query.refseqs,
				altseqs: req.query.altseqs,
				cigar_seq: lst[0].cigarstr,
				start_position: lst[0].segstart,
				ref_positions: req.query.ref_positions,
				refalleles: req.query.refalleles,
				altalleles: req.query.altalleles
			}
			//fs.writeFile('test.txt', JSON.stringify(input_data), function (err) {
			//	// For catching input to rust pipeline, in case of an error
			//	if (err) return console.log(err)
			//})
			const rust_output = await run_rust('align', JSON.stringify(input_data))
			const rust_output_list = rust_output.split('\n')
			let alignment_output
			for (let item of rust_output_list) {
				if (item.includes('Final_output:')) {
					//console.log('test:', item.replace('Final_output:', ''))
					alignment_output = JSON.parse(item.replace('Final_output:', ''))
				} else {
					console.log(item)
				}
			}
			lst.alignments = alignment_output
		}
		return lst
	}
	lst = []
	if (firstseg) lst.push(firstseg)
	if (lastseg) lst.push(lastseg)
	return lst.length ? lst : null
}

async function convertunmappedread2html(seg, genome, query) {
	// convert a read to html
	const quallst = qual2int(seg.qual)
	const querylst = ['<td style="color:black;text-align:left">Read</td>']
	for (const b of seg.boxes) {
		for (let i = 0; i < b.len; i++) {
			const nt1 = seg.seq[b.cidx + i]
			querylst.push(
				'<td style="background:' + qual2match(quallst[b.cidx + i] / maxqual) + '">' + seg.seq[b.cidx + i] + '</td>'
			)
		}
		continue
	}

	const lst = []
	lst.push(
		'<li><span style="background:' +
			discord_unmapped_hq +
			';color:white">This segment in template is unmapped</span></li>'
	)
	// indicate all flags
	if (seg.flag & 0x1) lst.push('<li>Template has multiple segments</li>')
	if (seg.flag & 0x2) lst.push('<li>Each segment properly aligned</li>')
	//if (seg.flag & 0x4) lst.push('<li>Segment unmapped</li>')
	if (seg.flag & 0x10) lst.push('<li>Reverse complemented</li>')
	if (seg.flag & 0x20) lst.push('<li>Next segment in the template is reverse complemented</li>')
	if (seg.flag & 0x40) lst.push('<li>This is the first segment in the template</li>')
	if (seg.flag & 0x80) lst.push('<li>This is the last segment in the template</li>')
	if (seg.flag & 0x100) lst.push('<li>Secondary alignment</li>')
	if (seg.flag & 0x200) lst.push('<li>Not passing filters</li>')
	if (seg.flag & 0x400) lst.push('<li>PCR or optical duplicate</li>')
	if (seg.flag & 0x800) lst.push('<li>Supplementary alignment</li>')

	let seq_data = {
		seq: seg.seq,
		alignment: `<table style="border-spacing:0px;border-collapse:separate;text-align:center">
			  <tr style="color:white">${querylst.join('')}</tr>
			</table>`,
		info: `<div style='margin-top:10px'>
			<span style="opacity:.5;font-size:.7em">TEMPLATE</span>: ${Math.abs(seg.seq.length)} bp,
			<span style="opacity:.5;font-size:.7em">CIGAR</span>: ${seg.cigarstr}
			<span style="opacity:.5;font-size:.7em">FLAG</span>: ${seg.flag}
			<span style="opacity:.5;font-size:.7em">NAME: ${seg.qname}</span>
		  </div>
		  <ul style='padding-left:15px'>${lst.join('')}</ul>`
	}
	if (seg.discord_unmapped2) {
		seq_data.unmapped_mate = true
	}
	return seq_data
}

async function convertread2html(seg, genome, query) {
	// convert a read to html
	const refstart = seg.boxes[0].start // 0 based
	const b = seg.boxes[seg.boxes.length - 1]
	const refstop = b.start + b.len
	const refseq = await get_refseq(genome, query.chr + ':' + (refstart + 1) + '-' + refstop)
	const quallst = qual2int(seg.qual)
	let reflst, querylst
	if (seg.seq == '*') {
		reflst = ['<td>Nucleotide sequence not available for this read</td>']
		querylst = ['<td></td>']
	} else {
		reflst = ['<td>Reference</td>']
		querylst = ['<td style="color:black;text-align:left">Read</td>']
		for (const b of seg.boxes) {
			if (b.opr == 'H') {
				continue
			}
			if (b.opr == 'I') {
				for (let i = b.cidx; i < b.cidx + b.len; i++) {
					reflst.push('<td>-</td>')
					if (seg.qual == '*') {
						// This happens in case of some long-read sequencing technology where phred-quality scores of nucleotides is not available. In that case all base-pairs are colored black in a white background
						querylst.push('<td style="color:' + insertion_hq + ';background:white">' + seg.seq[i] + '</td>')
					} else {
						querylst.push(
							'<td style="color:' +
								insertion_hq +
								';background:' +
								qual2match(quallst[i] / maxqual) +
								'">' +
								seg.seq[i] +
								'</td>'
						)
					}
				}
				continue
			}
			if (b.opr == 'D' || b.opr == 'N') {
				if (b.len >= readpanel_DN_maxlength) {
					reflst.push('<td style="font-size:.8em;opacity:.5;white-space:nowrap">' + b.len + ' bp</td>')
					querylst.push('<td style="color:black;white-space:nowrap">-----------</td>')
				} else {
					for (let i = 0; i < b.len; i++) {
						reflst.push('<td>' + refseq[b.start - refstart + i] + '</td>')
						querylst.push('<td style="color:black">-</td>')
					}
				}
				continue
			}
			if (b.opr == 'S') {
				for (let i = 0; i < b.len; i++) {
					reflst.push('<td>' + refseq[b.start - refstart + i] + '</td>')
					if (seg.qual == '*') {
						// This happens in case of some long-read sequencing technology where phred-quality scores of nucleotides is not available. In that case all base-pairs are colored black in a blue background
						querylst.push('<td style="background:' + qual2softclipbg(1) + '">' + seg.seq[b.cidx + i] + '</td>')
					} else {
						querylst.push(
							'<td style="background:' +
								qual2softclipbg(quallst[b.cidx + i] / maxqual) +
								'">' +
								seg.seq[b.cidx + i] +
								'</td>'
						)
					}
				}
				continue
			}
			if (b.opr == 'M' || b.opr == '=' || b.opr == 'X' || b.opr == '*') {
				for (let i = 0; i < b.len; i++) {
					const nt0 = refseq[b.start - refstart + i]
					const nt1 = seg.seq[b.cidx + i]
					reflst.push('<td>' + nt0 + '</td>')
					if (seg.qual == '*') {
						// This happens in case of some long-read sequencing technology where phred-quality scores of nucleotides is not available. In that case all base-pairs are colored black in a white background
						querylst.push(
							'<td style="color:black;background:' +
								(nt0.toUpperCase() == nt1.toUpperCase() ? qual2match : qual2mismatchbg) +
								'">' +
								seg.seq[b.cidx + i] +
								'</td>'
						)
					} else {
						querylst.push(
							'<td style="background:' +
								(nt0.toUpperCase() == nt1.toUpperCase() ? qual2match : qual2mismatchbg)(quallst[b.cidx + i] / maxqual) +
								'">' +
								seg.seq[b.cidx + i] +
								'</td>'
						)
					}
				}
				continue
			}
		}
	}

	// Determining start and stop position of softclips (if any)
	let soft_start = 0
	let soft_stop = 0
	let soft_starts = []
	let soft_stops = []
	let soft_present = 0
	for (const box of seg.boxes) {
		soft_start = soft_stop
		soft_stop += box.len
		if (box.opr == 'S') {
			soft_present = 1
			soft_starts.push(soft_start)
			soft_stops.push(soft_stop)
		}
	}

	const lst = []
	// indicate discordant read status
	if (seg.rnext) {
		lst.push(
			'<li>Next segment on <span style="background:' +
				ctxpair_hq +
				'">' +
				(query.nochr ? 'chr' : '') +
				seg.rnext +
				', ' +
				seg.pnext +
				'</span></li>'
		)
	}
	if (seg.discord_wrong_insertsize && seg.discord_orientation) {
		lst.push(
			'<li>' +
				'<span style="background:' +
				discord_wrong_insertsize_hq +
				';color:white">Wrong insert size</span>' +
				' mate position: ' +
				seg.pnext +
				'</li>' +
				'<li><span style="background:' +
				discord_orientation_hq +
				';color:white">Segments also having wrong orientation' +
				'</span> ' +
				seg.discord_orientation_direction +
				'</li>'
		)
	} else if (seg.discord_wrong_insertsize) {
		lst.push(
			'<li>' +
				'<span style="background:' +
				discord_wrong_insertsize_hq +
				';color:white">Wrong insert size</span>' +
				' mate position: ' +
				seg.pnext +
				'</li>'
		)
	} else if (seg.discord_orientation) {
		lst.push(
			'<li><span style="background:' +
				discord_orientation_hq +
				';color:white">Segments having wrong orientation' +
				'</span> ' +
				seg.discord_orientation_direction +
				'</li>'
		)
	} else if (seg.discord_unmapped2) {
		lst.push(
			'<li><span style="background:' +
				discord_unmapped_hq +
				';color:white">Other segment in template is unmapped</span></li>'
		)
	}

	// indicate all flags
	if (seg.flag & 0x1) lst.push('<li>Template has multiple segments</li>')
	if (seg.flag & 0x2) lst.push('<li>Each segment properly aligned</li>')
	//if (seg.flag & 0x4) lst.push('<li>Segment unmapped</li>')
	if (seg.flag & 0x10) lst.push('<li>Reverse complemented</li>')
	if (seg.flag & 0x20) lst.push('<li>Next segment in the template is reverse complemented</li>')
	if (seg.flag & 0x40) lst.push('<li>This is the first segment in the template</li>')
	if (seg.flag & 0x80) lst.push('<li>This is the last segment in the template</li>')
	if (seg.flag & 0x100) lst.push('<li>Secondary alignment</li>')
	if (seg.flag & 0x200) lst.push('<li>Not passing filters</li>')
	if (seg.flag & 0x400) lst.push('<li>PCR or optical duplicate</li>')
	if (seg.flag & 0x800) lst.push('<li>Supplementary alignment</li>')

	let seq_data = {
		seq: seg.seq,
		alignment: `<table style="border-spacing:0px;border-collapse:separate;text-align:center;font-family:courier">
			  <tr style="opacity:.6">${reflst.join('')}</tr>
			  <tr style="color:white">${querylst.join('')}</tr>
			</table>`,
		info: `<div style='margin-top:10px'>
			<span style="opacity:.5;font-size:.7em">CHR</span>: ${query.chr.replace('chr', '')},
			<span style="opacity:.5;font-size:.7em">START</span>: ${seg.segstart_original + 1},
			<span style="opacity:.5;font-size:.7em">STOP</span>: ${refstop},
			<span style="opacity:.5;font-size:.7em">READ LENGTH</span>: ${seg.seq.length} bp,
			<span style="opacity:.5;font-size:.7em">TEMPLATE LENGTH</span>: ${Math.abs(seg.tlen)} bp,
			<span style="opacity:.5;font-size:.7em">CIGAR</span>: ${seg.cigarstr}
			<span style="opacity:.5;font-size:.7em">FLAG</span>: ${seg.flag}
			<span style="opacity:.5;font-size:.7em">NAME: ${seg.qname}</span>
		  </div>
		  <ul style='padding-left:15px'>${lst.join('')}</ul>`,
		start_readpos: refstart + 1, // Start position of read
		boxes: seg.boxes,
		readpanel_DN_maxlength: readpanel_DN_maxlength
	}
	if (soft_present == 1) {
		seq_data.soft_starts = soft_starts
		seq_data.soft_stops = soft_stops
	}
	if (seg.discord_unmapped2) {
		seq_data.unmapped_mate = true
	}
	return seq_data
}

/////////////////////// gdc slicing ///////////////////////

function getGDCcacheFileName(req) {
	const md5Hasher = crypto.createHmac('md5', gdcHashSecret)
	const lst = [
		req.get('X-Auth-Token') || req.cookies.sessionid, // use token or session, whichever is given
		req.query.gdcFileUUID,
		req.query.gdcFilePosition
	]
	return md5Hasher.update(lst.join('')).digest('hex') + '.bam'
}

/*
req.query{}
	gdcFileUUID:str
	gdcFilePosition:str // same as regions[0]
	regions:[ {chr/start/stop}, ... ]

returns list of slice file sizes that's been cached

function is also called during visualization requests, for re-slicing and caching the same bam on a new container
*/
async function downloadGdcBam2cacheFile_withDenial(req) {
	if (!req.query.gdcFileUUID || !req.query.gdcFilePosition || !req.query.file) {
		// since this function can be directly triggered by a request flag irrespetive whether gdc properties are present, must check to be sure
		throw 'cannot download GDC BAM slice: request is unauthorized'
	}

	// query gdc bam slicing api using the uuid of one bam file
	// download one bam slice for each region
	const regions = req.query.regions
	if (!Array.isArray(regions) || regions.length == 0) throw 'req.query.regions[] not non-empty array'
	let fileStat
	for (const r of regions) {
		// FIXME NOTE FUTURE SOLUTION
		// use one slice file for multi region view. find a way to concatenate sliced reads from multiple regions into one cache file
		fileStat = await get_gdc_bam(r.chr, r.start, r.stop, req.query.gdcFileUUID, getGDCcacheFileName(req), req)
	}
	return fileStat
}

/* not in use: client now calls slicing api directly to download
async function streamGdcBam2response(req, res) {
	const { host, headers } = getGdcDs(req.query.__genomes).getHostHeaders(req.query)
	headers.compression = false // see comments in get_gdc_bam()

	const url = path.join(host.rest, '/slicing/view/', req.query.gdcFileUUID + '?region=' + req.query.gdcFilePosition)
	try {
		const sourceStream = got.stream(url, { method: 'GET', headers }) // source of data, will be streamed into res

		let totalBytes = 0
		sourceStream.on('data', chunk => {
			totalBytes += chunk.length
			if (totalBytes > serverconfig.features.gdcBam.streamMaxSize) {
				sourceStream.destroy()
				res.end()
				// no need to add further text in end() or try to signal to client in any other means, client will detect missing BAM EOF
			}
		})

		sourceStream.pipe(res)
	} catch (e) {
		if (e.code == 'ERR_STREAM_PREMATURE_CLOSE') {
			// happens when client reload page in the mid of streaming bam data from backend. somehow the response header is already set. must not do res.send() again to avoid ERR_HTTP_HEADERS_SENT that crashes server
			return
		}
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
*/

/*
	BAM deletion is prioritized by last modified time, not access time (to avoid relatime issues),
	although they will be equal due to using utimes() to reset both in get_gdc_bam(). From
	https://manpages.ubuntu.com/manpages/bionic/en/man8/mount.8.html:
    
    relatime (default mount used in GDC hosts for PP container)
      Update inode access times relative to modify or change time. Access time is only
      updated if the previous access time was earlier than the current modify or change
      time.

	Each call to get_gdc_bam() will trigger mayDeleteCacheFiles() if 
	there is no pending timeout for it already, to avoid multiples of that 
	function running at the same time unnecessarily. 

	Another setTimeout() may also be triggered at the end of mayDeleteCacheFiles(),
	if there are remaining files, with the wait time set to the oldest mtime.

	must not move features.bamCache{} into gdc ds serverconfigFeatures{}! that prevents bamtk to work in an instance without gdc ds
*/

const bamCache = serverconfig.features.bamCache || {}
// the max age for the modified time, will delete files whose modified time exceeds this "aged" access
const maxAge = bamCache.maxAge || 2 * 60 * 60 * 1000 // in milliseconds
// maximum allowed cache size in bytes
const maxSize = bamCache.maxSize || 5e9
// checkWait:
// time to wait before triggering another call to mayDeleteCacheFiles(),
// this is used to debounce/prevent multiple active calls to mayDeleteCacheFiles()
// also assumed to be roughly equivalent to the minimum required time for a bam file read
// to complete, otherwise deleting sooner than this may cause a bam file read error;
// this last assumption only applies to file deletion when the maxSize is exceeded
const checkWait = bamCache.checkWait || 1 * 60 * 1000

// a pending timeout reference from setTimeout that calls mayDeleteCacheFiles
let cacheCheckTimeout,
	nextCheckTime = 0
// only run this loop if configured, otherwise will only rely on
// cleanup as new bam requests come in
if (serverconfig.features.bamCache) mayResetCacheCheckTimeout(checkWait)

function mayResetCacheCheckTimeout(wait = 0) {
	const checkTime = Date.now() + wait
	if (cacheCheckTimeout) {
		if (nextCheckTime && nextCheckTime <= checkTime + 5) return
		else {
			clearTimeout(cacheCheckTimeout)
			cacheCheckTimeout = undefined
		}
	}
	nextCheckTime = checkTime
	console.log(`will trigger mayDeleteCacheFiles() in ${wait} ms`)
	cacheCheckTimeout = setTimeout(mayDeleteCacheFiles, wait)
}

async function mayDeleteCacheFiles() {
	console.log(`checking for cached bam files to delete ...`)
	try {
		const minTime = Date.now() - maxAge
		const filenames = await fs.promises.readdir(serverconfig.cachedir_bam)
		const files = [] // keep list of undeleted bam files. may need to rank them and delete old ones ranked by age
		let totalSize = 0,
			deletedSize = 0,
			totalCount = 0,
			deletedCount = 0
		for (const filename of filenames) {
			if (!filename.endsWith('.bam') && !filename.endsWith('.bai')) continue
			totalCount++
			const fp = path.join(serverconfig.cachedir_bam, filename)
			const s = await fs.promises.stat(fp)
			if (!s.isFile()) continue
			const time = s.mtimeMs
			if (time < minTime) {
				await fs.promises.unlink(fp)
				deletedCount++
				deletedSize += s.size
				continue
			}
			files.push({
				path: fp,
				time,
				size: s.size
			})
			totalSize += s.size
		}
		files.sort((i, j) => j.time - i.time) // descending
		if (totalSize >= maxSize) {
			/*
			storage use is still above limit, deleting files just older than cutoff is not enough
			a lot of recent requests may have deposited lots of cache files
			must delete more old files ranked by age
			*/
			const minMtime = Date.now() - checkWait
			for (const f of files) {
				// do not delete files too soon that it may affect a current file read
				if (f.time > minMtime) break
				await fs.promises.unlink(f.path)
				f.deleted = true
				deletedCount++
				deletedSize += f.size
				totalSize -= f.size
				if (totalSize < maxSize) break
			}
		}
		console.log(
			`deleted ${deletedCount} of ${totalCount} cached bam files (${deletedSize} bytes deleted, ${totalSize} remaining)`
		)
		// empty out the following tracking variables
		cacheCheckTimeout = undefined
		nextCheckTime = 0
		const nextFile = totalSize && files.find(f => !f.deleted)
		if (nextFile) {
			// trigger another mayDeleteCachefile() call with setTimeout,
			// using the oldest file mtime + checkWait as the wait time,
			// or much sooner if the max cache size is currently exceeded
			const wait = checkWait + Math.round(totalSize >= maxSize ? 0 : Math.max(0, nextFile.time + maxAge - Date.now()))
			mayResetCacheCheckTimeout(wait)
		}
	} catch (e) {
		console.error('Error in mayDeleteCacheFiles(): ' + e)
	}
}

async function get_gdc_bam(chr, start, stop, gdcFileUUID, bamfilename, req) {
	// before creating new cache file, check if possible to delete cache files
	// only trigger a new check if a pending timeout doesn't already exist
	mayResetCacheCheckTimeout(checkWait)

	// decompress: false prevents got from setting an 'Accept-encoding: gz' request header,
	// which may not be handled properly by the GDC API in qa-uat
	// per Phil, should only be used as a temporary workaround
	// Also:
	// since the expected response is binary data, should not set Accept: application/json as a request header
	// also no body is submitted with a GET request, should not set a Content-type request header
	const { host, headers } = getGdcDs(req.query.__genomes).getHostHeaders(req.query)
	headers.compression = false
	const fullpath = path.join(serverconfig.cachedir_bam, bamfilename)
	const url = path.join(host.rest, '/slicing/view/', gdcFileUUID + '?region=' + chr + ':' + start + '-' + stop)

	let timeTaken4streaming = 0

	try {
		const time = Math.round(Date.now() / 1000)

		let fileIsTruncated = false
		/* set to true at:
		1) when cache file doesn't exist, a new one is streamed from gdc api and terminated due to exceeding max size limit
		2) when cache file exists, samtools quickcheck found EOF missing

		when set to true, do not throw and abort. do not index this bam and just read all its reads without supplying a coordinate.

		per Zhenyu 5/8/2024, "samtools view" will work on a truncated bam:
		"BAM are bgzip block compressed, so the last block will not be open if truncated, but previous blocks should be fine"
		thus a truncated bam that's big enough should be viewable for all its blocks except the last one
		*but* a truncated bam that's too small to have only one block won't work
		a bam too small shouldn't be a concern as gdc streaming is only terminated at 100Mb
		also no need to worry about appending EOF marker to such bam, it doesn't matter
		*/

		if (await utils.file_not_exist(fullpath)) {
			// bam file not found. download

			const sourceStream = got.stream(url, { method: 'GET', headers })
			const writeStream = fs.createWriteStream(fullpath)
			let totalBytes = 0

			// not doing sourceStream.on('data'), since it always ends in ERR_STREAM_WRITE_AFTER_END, in that data are still being written to write stream that's already closed
			const transformStream = new Transform({
				transform(chunk, encoding, callback) {
					totalBytes += chunk.length
					if (totalBytes > serverconfig.features.gdcBam.cacheMaxSize) {
						fileIsTruncated = true
						callback(null, null) // stop the pipeline
					} else {
						callback(null, chunk) // continue with the current chunk
					}
				}
			})

			// not using sourceStream.pipe() so no need to deal with those callbacks as on(close) and on(error)
			await pipeline(sourceStream, transformStream, writeStream)

			/* no longer aborts when streaming is killed
			if (tooBigTerminated) {
				//await appendEOF2truncatedFile2(fullpath)
				try {
					await fs.promises.stat(fullpath)
					await fs.promises.unlink(fullpath) // do it after successful stat to be safe
				} catch (e) {
					// ignore case e.g. file is not found or error deleting it
				}

				// message client
				throw `slice file size exceeds ${fileSize(
					serverconfig.features.gdcBam.cacheMaxSize
				)}. Please reduce query region size and try again.`
			}
			*/

			if (await utils.file_not_exist(fullpath)) throw 'BAM file slice is not found after downloading' // unknown error

			timeTaken4streaming = Date.now() / 1000 - time
		} else {
			// bam file found, no need to re-download
			// change the modify times to prevent automated deletion with mayDeleteCacheFiles()
			await fs.promises.utimes(fullpath, time, time)
		}

		fileIsTruncated = await samtoolsQuickcheck(fullpath)
		// false for normal file, true for truncated, throw if any other issue

		if (fileIsTruncated) {
			// cache file is truncated. do not index (will fail) and view as is
		} else {
			// cache file is whole. index it to allow faster query
			const baiFilePath = fullpath + '.bai'
			if (await utils.file_not_exist(baiFilePath)) {
				// index file not found. do indexing
				await index_bam(fullpath)
				// index file is supposed to be produced
				if (await utils.file_not_exist(baiFilePath)) {
					throw 'index file is missing after indexing'
				}
			} else {
				// change the modify times to prevent automated deletion with mayDeleteCacheFiles()
				await fs.promises.utimes(baiFilePath, time, time)
			}
		}

		const fileStat = { size: bplen((await fs.promises.stat(fullpath)).size, true) }
		if (fileIsTruncated) fileStat.truncated = 1
		if (timeTaken4streaming) fileStat.time = timeTaken4streaming
		return fileStat
	} catch (e) {
		if (e.stack) console.log(e.stack)
		throw 'Error with BAM slicing: ' + (e.message || e)
	}
}

async function samtoolsQuickcheck(file) {
	try {
		await utils.get_lines_bigfile({
			isbam: true,
			args: ['quickcheck', file],
			callback: line => {}
		})
	} catch (e) {
		// on any error, it outputs line(s) to standard error. catch such error and assess
		if (e.trim().endsWith(utils.SAMTOOLS_ERR_MSG.quickcheck)) return true // file is truncated. return true
		throw 'unhandled bam check error: ' + e
	}
	return false // no output. file is fine. return false
}

async function index_bam(file) {
	// only work for gdc bam slices, file is absolute path in cache dir
	await utils.get_lines_bigfile({
		isbam: true,
		args: ['index', file],
		callback: () => {}
	})
}
