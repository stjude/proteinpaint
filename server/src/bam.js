const app = require('./app')
const stream = require('stream')
const crypto = require('crypto')
const { promisify } = require('util')
const got = require('got')
const pipeline = promisify(stream.pipeline)
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const createCanvas = require('canvas').createCanvas
const spawn = require('child_process').spawn
const readline = require('readline')
const interpolateRgb = require('d3-interpolate').interpolateRgb
const match_complexvariant = require('./bam.kmer.indel').match_complexvariant
const rust_match_complexvariant = require('./bam.kmer.indel').match_complexvariant_rust
const bamcommon = require('./bam.common')
const basecolor = require('../shared/common').basecolor
const serverconfig = require('./serverconfig')

/*
XXX quick fix to be removed/disabled later
-- __tempscore 

1. reads are parsed into template/segments
2. mismatch checked if sufficient zoom in
3. divide reads to groups:
   upon first query, will produce all possible groups based on variant type
   - snv/indel yields up to 3 groups
     1. if by snv, will require mismatches
     2. if by complex variant, require read sequence to do k-mer or blast
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

*********************** new q{}
.grouptype, .partstack{} // having partstack indicates it's in the partstack mode
.genome
.devicePixelRatio
.asPaired
.stacksegspacing
.canvaswidth
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
	.messagerows[ {} ]
.messagerows[ {} ]
	.h int
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
.qual[]


*********************** function cascade
download_gdc_bam  // For downloading gdc bam files
	get_gdc_bam
		index_bam
get_q
do_query
	query_reads
		query_region
	get_templates
		parse_one_segment
	may_checkrefseq4mismatch
		check_mismatch
	divide_reads_togroups
		may_match_snv
			make_type2group
				duplicateRegions
		match_complexvariant
		match_sv
	(for each group...)
		stack_templates
			may_trimstacks
		poststack_adjustq
			getstacksizebystacks
			get_refseq
		finalize_templates
			get_stacky
				overlapRP_setflag
				getrowheight_template_overlapread
		plot_messagerows
		plot_template
			plot_segment
		plot_insertions
	plot_pileup
		run_samtools_depth
		collect_softclipmismatch2pileup
route_getread
    query_one_read
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
const discord_orientation_hq = '#ff0aef'
const discord_orientation_lq = '#ffd6fe'
const qual2discord_orientation = interpolateRgb(discord_orientation_lq, discord_orientation_hq)
// insertion, text color gradient to correlate with the quality
// cyan
const insertion_hq = '#47FFFC' //'#00FFFB'
const insertion_lq = '#B2D7D7' //'#009290'
// red
//const insertion_hq = '#ff1f1f'
//const insertion_lq = '#ffa6a6'
// magenta
//const insertion_hq = '#ff00dd' // '#ff4fe5'
//const insertion_lq = '#ffbff6'
// bright green
//const insertion_hq = '#00ff2a'
//const insertion_lq = '#c4ffce'
// yellow
//const insertion_hq = '#ffff14'
//const insertion_lq = '#ffffa6'
// white
//const insertion_hq = '#ffffff'
//const insertion_lq = '#d4d4d4'

const qual2insertion = interpolateRgb(insertion_lq, insertion_hq)
const insertion_maxfontsize = 12
const insertion_minfontsize = 7

const deletion_linecolor = 'red'
const split_linecolorfaint = '#ededed' // if thin stack (hardcoded cutoff 2), otherwise use match_hq
const overlapreadhlcolor = 'blue'
const insertion_vlinecolor = 'black'
const pileup_totalcolor = '#e0e0e0'

const alt_diff_score_color = '#FF0000'
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

const maxreadcount = 30000 // maximum number of reads to load
const maxcanvasheight = 1500 // ideal max canvas height in pixels

const bases = new Set(['A', 'T', 'C', 'G'])

const samtools = serverconfig.samtools || 'samtools'

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (req.query.downloadgdc) {
				const gdc_bam_filenames = await download_gdc_bam(req)
				res.send(gdc_bam_filenames)
				return
			}

			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (req.query.getread) {
				res.send(await route_getread(genome, req))
				return
			}

			const q = await get_q(genome, req)
			res.send(await do_query(q))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

/*
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

async function download_gdc_bam(req) {
	const gdc_bam_filenames = [] // Can be multiple bam files for multiple regions in the same sample
	for (const r of JSON.parse(req.query.regions)) {
		const gdc_token = req.get('x-auth-token')
		const gdc_file_id = req.query.gdc_file
		const md5Hasher = crypto.createHmac('md5', serverconfig.gdcbamsecret)
		const gdc_token_hash = md5Hasher.update(gdc_token).digest('hex')
		const dir = serverconfig.cachedir + '/' + gdc_token_hash
		try {
			await fs.promises.stat(dir)
		} catch (e) {
			if (e.code == 'ENOENT') {
				// make dir
				try {
					await fs.promises.mkdir(dir, { recursive: true })
				} catch (e) {
					throw 'url dir: cannot mkdir'
				}
			} else {
				throw 'stating gz url dir: ' + e.code
			}
		}
		const gdc_bam_filename = path.join(gdc_token_hash, 'temp.' + Math.random().toString() + '.bam')
		// Need to make directory for each user using token
		await get_gdc_bam(r.chr, r.start, r.stop, gdc_token, gdc_file_id, gdc_bam_filename)
		gdc_bam_filenames.push(gdc_bam_filename)
	}
	return gdc_bam_filenames
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
	const diff_scores_list = templates.map(i => parseFloat(i.__tempscore))
	const read_height = (group.canvasheight - group.messagerows[0].h) / diff_scores_list.length
	let i = 0
	const dist_bw_reads = group.stackspace / group.canvasheight
	for (const diff_score of diff_scores_list) {
		//console.log('diff_score:', diff_score)
		if (diff_score > 0) {
			ctx.fillStyle = alt_diff_score_color
		} else {
			ctx.fillStyle = ref_diff_score_color
		}
		ctx.fillRect(
			min_diff_score * -1 * multiplication_factor,
			(i + 1) * read_height,
			//(diff_score * 50 * -1) / min_diff_score,
			diff_score * multiplication_factor,
			read_height - dist_bw_reads * read_height
		)

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

			const barwidth = Math.max(1, r.ntwidth) * (r.width / q.canvaswidth) // when in zoomed out mode, each bar is one pixel, thus the width=1

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

async function get_q(genome, req) {
	let q
	// if gdc_token and case_id present, it will be moved to x-auth-token
	if (req.get('x-auth-token')) {
		q = {
			genome,
			file: path.join(serverconfig.cachedir, req.query.file), // will need to change this to a loop when viewing multiple regions in the same gdc sample
			asPaired: req.query.asPaired,
			getcolorscale: req.query.getcolorscale,
			_numofreads: 0, // temp, to count num of reads while loading and detect above limit
			messagerows: [],
			devicePixelRatio: req.query.devicePixelRatio ? Number(req.query.devicePixelRatio) : 1
		}
		//q.gdc_token = req.get('x-auth-token').split(',')[0]
		q.gdc_file = req.query.gdc_file
		//q.file = path.join(serverconfig.cachedir, 'temp.' + Math.random().toString() + '.bam')
	} else {
		const [e, _file, isurl] = app.fileurl(req)
		if (e) throw e
		// a query object to collect all the bits
		q = {
			genome,
			file: _file, // may change if is url
			asPaired: req.query.asPaired,
			getcolorscale: req.query.getcolorscale,
			_numofreads: 0, // temp, to count num of reads while loading and detect above limit
			messagerows: [],
			devicePixelRatio: req.query.devicePixelRatio ? Number(req.query.devicePixelRatio) : 1
		}
		if (isurl) {
			q.dir = await utils.cache_index(_file, req.query.indexURL || _file + '.bai')
		}
	}

	if (req.query.pileupheight) {
		q.pileupheight = Number(req.query.pileupheight)
		if (Number.isNaN(q.pileupheight)) throw '.pileupheight is not integer'
	}
	if (req.query.variant) {
		q.diff_score_plotwidth = Number(req.query.diff_score_plotwidth)
		if (req.query.max_diff_score) {
			q.max_diff_score = Number(req.query.max_diff_score)
			q.min_diff_score = Number(req.query.min_diff_score)
		}
		const t = req.query.variant.split('.')
		if (t.length != 5) throw 'invalid variant, not chr.pos.ref.alt.strictness'
		q.variant = {
			chr: t[0],
			pos: Number(t[1]),
			ref: t[2].toUpperCase(),
			alt: t[3].toUpperCase(),
			strictness: t[4]
		}
		if (Number.isNaN(q.variant.pos)) throw 'variant pos not integer'
	} else if (req.query.sv) {
		const t = req.query.sv.split('.')
		if (t.length != 4) throw 'invalid sv, not chrA.posA.chrB.posB'
		q.sv = {
			chrA: t[0],
			posA: Number(t[1]),
			chrB: t[2],
			posB: Number(t[3])
		}
		if (Number.isNaN(q.sv.posA)) throw 'sv.posA not integer'
		if (Number.isNaN(q.sv.posB)) throw 'sv.posB not integer'
	}

	if (req.query.stackstart) {
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
		q.nochr = JSON.parse(req.query.nochr) // parse "true" into json true
	} else {
		// info not provided
		q.nochr = await app.bam_ifnochr(q.file, genome, q.dir)
	}
	if (!req.query.regions) throw '.regions[] missing'
	//console.log('req.query.regions:', req.query.regions)
	q.regions = JSON.parse(req.query.regions)

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
	return q
}

async function do_query(q) {
	await query_reads(q)
	delete q._numofreads // read counter no longer needed after loading
	q.totalnumreads = q.regions.reduce((i, j) => i + j.lines.length, 0)

	// parse reads and cigar
	//const templates = get_templates(q)
	// if zoomed in, will check reference for mismatch, so that templates can be divided by snv
	// read quality is not parsed yet
	//await may_checkrefseq4mismatch(templates, q)

	const result = {
		nochr: q.nochr,
		count: {
			r: q.totalnumreads
		},
		groups: []
	}
	if (q.read_limit_reached) {
		// When maximum read limit is reached
		result.count.read_limit = q.read_limit_reached
	}

	q.canvaswidth = q.regions[q.regions.length - 1].x + q.regions[q.regions.length - 1].width
	{
		const out = await divide_reads_togroups(q) // templates
		q.groups = out.groups
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
		q.groups[0].messagerows.push({
			h: 30,
			t: 'No reads in view range.'
		})
	}

	let templates_total = []
	for (const group of q.groups) {
		// do stacking for each group separately
		// attach temp attributes directly to "group", rendering result push to results.groups[]

		// parse reads and cigar
		let templates = get_templates(q, group)
		//let temp_array = templates.map((i) => i.segments[0].ridx)
		//for (const item of temp_array) {
		//	console.log('element:', item)
		//}
		templates = stack_templates(group, q, templates) // add .stacks[], .returntemplatebox[]
		await poststack_adjustq(group, q) // add .allowpartstack
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
			count: { r: templates.reduce((i, j) => i + j.segments.length, 0) } // group.templates
		}

		const canvas = createCanvas(q.canvaswidth * q.devicePixelRatio, group.canvasheight * q.devicePixelRatio)
		const ctx = canvas.getContext('2d')
		if (q.devicePixelRatio > 1) {
			ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
		}

		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'

		gr.messagerowheights = plot_messagerows(ctx, group, q)

		for (const template of templates) {
			// group.templates
			plot_template(ctx, template, group, q)
		}

		plot_insertions(ctx, group, q, templates, gr.messagerowheights)

		if (q.asPaired) gr.count.t = templates.length // group.templates
		if (q.variant) {
			// diff scores plotted only if a variant is specified by user
			gr.diff_scores_img = await plot_diff_scores(q, group, templates, result.max_diff_score, result.min_diff_score)
		}

		gr.src = canvas.toDataURL()
		result.groups.push(gr)
		templates_total = [...templates_total, ...templates]
	}
	if (q.getcolorscale) result.colorscale = getcolorscale()
	if (q.kmer_diff_scores_asc) {
		result.kmer_diff_scores_asc = q.kmer_diff_scores_asc
	}
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

	// Deleting temporary gdc bam file

	//if (q.gdc_case_id) {
	//	fs.unlink(q.file, err => {
	//		if (err) console.log(err)
	//		else {
	//			console.log('Deleted file: ' + q.file.toString())
	//		}
	//	})
	//}
	return result
}

async function query_reads(q) {
	/*
	if variant, query just the region at the variant position
	then, assign the reads to q.regions[0]
	assume just one region

	if sv, query at the two breakends, and assign reads to two regions one for each breakend
	assume two regions

	otherwise, query for every region in q.regions
	*/
	//if (q.variant) {
	//	const r = {
	//		chr: q.variant.chr,
	//		start: q.variant.pos,
	//		stop: q.variant.pos + q.variant.ref.length,
	//	}
	//	await query_region(r, q)
	//	q.regions[0].lines = r.lines
	//	return
	//}
	if (q.sv) {
		return
	}
	for (const r of q.regions) {
		await query_region(r, q) // add r.lines[]
	}
}

async function get_gdc_bam(chr, start, stop, token, case_id, cache_dir) {
	// The chr variable must contain "chr"
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	headers['X-Auth-Token'] = token
	const file = path.join(serverconfig.cachedir, cache_dir)
	// Inserted "chr" in url. Need to check if it works with other gdc bam files
	const url = 'https://api.gdc.cancer.gov/slicing/view/' + case_id + '?region=' + chr + ':' + start + '-' + stop
	try {
		await pipeline(got.stream(url, { method: 'GET', headers }), fs.createWriteStream(file))
		await index_bam(file)
	} catch (error) {
		console.log(error)
		console.log('Cannot retrieve bam file')
		throw 'Cannot retrieve bam file: ' + error
	}
}

function index_bam(file) {
	// only work for gdc bam slices, file is absolute path in cache dir
	return new Promise((resolve, reject) => {
		const ps = spawn(samtools, ['index', file])
		ps.on('close', code => {
			resolve()
		})
	})
}

function query_region(r, q) {
	// for each region, query its data
	// if too many reads, collapse to coverage
	r.lines = []
	return new Promise((resolve, reject) => {
		let ps = ''
		//console.log(
		//	'samtools view ' + q.file + ' ' + (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
		//)
		if (q.gdc_case_id) {
			ps = spawn(samtools, ['view', q.file], { cwd: q.dir })
		} else {
			ps = spawn(
				samtools,
				['view', q.file, (q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop],
				{ cwd: q.dir }
			)
		}
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
			r.lines.push(line)
			q._numofreads++
			if (q._numofreads >= maxreadcount) {
				ps.kill()
				q.read_limit_reached = true
				q.messagerows.push({
					h: 13,
					t: 'Too many reads in view range. Try zooming into a smaller region.'
				})
			}
		})
		rl.on('close', () => {
			resolve()
		})
	})
}

/*
'samtools depth' returns single base depth
results are collected in bplst[]
when region resolution is high (>=1 pixels for each bp), bplst[] has one element per basepair;
when region resolution is low with #bp per pixel is above a cutoff e.g. 3,
should summarize into bins, each bin for a pixel with .coverage for each pixel, with one element for each bin in bplst[]
*/
function run_samtools_depth(q, r) {
	const bplst = []
	return new Promise((resolve, reject) => {
		// must use r.start+1 to query bam
		const ps = spawn(
			samtools,
			[
				'depth',
				'-r',
				(q.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + (r.start + 1) + '-' + r.stop,
				'-g',
				'DUP',
				q.file || q.url
			],
			{ cwd: q.dir }
		)
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
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
		})
		rl.on('close', () => {
			if (r.ntwidth < 1) {
				// get average for each bin
				for (const b of bplst) {
					if (!b) continue // could be undefined elements (gaps)
					b.total = b.sum / b.count
					delete b.sum
					delete b.count
				}
			}
			resolve(bplst)
		})
	})
}

async function may_checkrefseq4mismatch(templates, q) {
	// requires ntwidth
	// read quality is not parsed yet, so need to set cidx for mismatch box so its quality can be added later
	// FIXME call this after poststack_adjustq(), as then the to_printnt flags will be set and will know if to attach b.s
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
	//if (templates.length == 0) {
	const templates_info = []

	let count_reads_in_regions = false // Flag to check if there are no reads in any of the region
	const widths = []
	let width = 0
	for (const r of q.regions) {
		for (const line of r.lines) {
			// FIXME to support multi-region
			// q.regions[0] may need to be modified
			templates_info.push({ sam_info: line, tempscore: '' })
		}
		width = r.x + r.width // Storing the extreme right position of every region
		if (r.lines.length != 0) {
			// no reads at all, return empty group
			count_reads_in_regions = true
		}
		widths.push(width) // Storing widths of regions
	}

	if (count_reads_in_regions == false) {
		// This condition will only be true if both regions do not contain any reads
		return {
			groups: [
				{
					type: bamcommon.type_all,
					regions: bamcommon.duplicateRegions(q.regions),
					templates: templates_info,
					messagerows: [],
					partstack: q.partstack,
					widths: widths
				}
			]
		}
	}

	if (q.variant) {
		// if snv, simple match; otherwise complex match
		//const lst = may_match_snv(templates, q)
		//if (lst) return { groups: lst }
		//for (const template of templates) {

		if (q.regions.length == 1) {
			if (serverconfig.features.rust_indel) {
				// If this toggle is on, the rust indel pipeline is invoked otherwise the nodejs indel pipeline is invoked
				return await rust_match_complexvariant(q, templates_info, widths)
			} else {
				return await match_complexvariant(q, templates_info, widths)
			}
		}
	}
	if (q.sv) {
		return match_sv(templates, q)
	}

	// no variant, return single group
	return {
		groups: [
			{
				type: bamcommon.type_all,
				regions: bamcommon.duplicateRegions(q.regions),
				templates: templates_info,
				messagerows: [],
				partstack: q.partstack,
				widths: widths
			}
		]
	}
}

function may_match_snv(templates, q) {
	const refallele = q.variant.ref.toUpperCase()
	const altallele = q.variant.alt.toUpperCase()
	if (!bases.has(refallele) || !bases.has(altallele)) return
	const type2group = bamcommon.make_type2group(q)
	for (const t of templates) {
		let used = false
		for (const s of t.segments) {
			for (const b of s.boxes) {
				if (b.opr == 'X' && b.start == q.variant.pos) {
					// mismatch on this pos
					if (b.s == altallele) {
						if (type2group[bamcommon.type_supportalt]) type2group[bamcommon.type_supportalt].templates.push(t)
					} else {
						if (type2group[bamcommon.type_supportno]) type2group[bamcommon.type_supportno].templates.push(t)
					}
					used = true
					break
				}
			}
			if (used) break
		}
		if (!used) {
			if (type2group[bamcommon.type_supportref]) type2group[bamcommon.type_supportref].templates.push(t)
		}
	}
	const groups = []
	for (const k in type2group) {
		const g = type2group[k]
		if (g.templates.length == 0) continue // empty group, do not include
		g.messagerows.push({
			h: 15,
			t:
				g.templates.length +
				' reads supporting ' +
				(k == bamcommon.type_supportref
					? 'reference allele'
					: k == bamcommon.type_supportalt
					? 'mutant allele'
					: 'neither reference or mutant alleles')
		})
		groups.push(g)
	}
	return groups
}

function match_sv(templates, q) {
	// TODO templates may not be all in one array?
}

function get_templates(q, group) {
	// parse reads from all regions
	// returns an array of templates, no matter if paired or not
	if (!q.asPaired) {
		// pretends single reads as templates
		const lst = []
		// to account for reads spanning between multiple regions, may use qname2read = new Map()
		for (let i = 0; i < q.regions.length; i++) {
			const r = q.regions[i]
			//for (const line of r.lines) {
			for (const line of group.templates) {
				line.r = r
				line.ridx = i
				const segment = parse_one_segment(line)
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
		//for (const line of r.lines) {
		for (const line of group.templates) {
			line.r = r
			line.ridx = i
			const segment = parse_one_segment(line)
			if (!segment || !segment.qname) continue
			const temp = qname2template.get(segment.qname)
			if (temp) {
				// add this segment to existing template
				temp.segments.push(segment)
				temp.x2 = Math.max(temp.x2, segment.x2)
			} else {
				qname2template.set(segment.qname, {
					x1: segment.x1,
					x2: segment.x2,
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
*/
function parse_one_segment(arg) {
	const {
		sam_info, // sam line
		tempscore,
		r,
		ridx,
		keepallboxes,
		keepmatepos,
		keepunmappedread // return object if the read is unmapped
	} = arg
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
		seq = l[10 - 1],
		qual = l[11 - 1]

	if (Number.isNaN(segstart_1based) || segstart_1based <= 0) {
		// invalid
		return
	}
	const segstart = segstart_1based - 1
	if (flag & 0x4) {
		if (keepunmappedread) {
			const segment = {
				qname,
				segstart,
				segstop: segstart,
				boxes: [
					{
						opr: cigarstr,
						start: segstart,
						len: seq.length,
						cidx: 0,
						qual
					}
				],
				forward: !(flag & 0x10),
				ridx,
				seq,
				qual,
				cigarstr,
				tlen,
				flag,
				discord_unmapped1: true
			}
			if (flag & 0x40) {
				segment.isfirst = true
			} else if (flag & 0x80) {
				segment.islast = true
			}
			return segment
		}
		// return undefined so the unmapped read will not render
		// may collect number of unmapped reads in view range and report
		return
	}

	// from here, read is mapped
	if (cigarstr == '*') {
		// why this case?
		return
	}
	const boxes = [] // collect plottable segments
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
			boxes.push({
				opr: cigar,
				start: pos,
				len,
				cidx: cum - len
			})
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
				boxes.push({
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
					boxes.push({
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
			if ((pos >= r.start && pos <= r.stop) || (pos + len - 1 >= r.start && pos + len - 1 <= r.stop)) {
				boxes.push({
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
				boxes.push(b)
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
			if (boxes.length == 0) {
				// this is the first box, will not consume ref
				// shift softclip start to left, so its end will be pos, will not increment pos
				b.start -= len
				if (keepallboxes || Math.max(pos, r.start) < Math.min(pos + len - 1, r.stop)) {
					boxes.push(b)
				}
			} else {
				// not the first box, so should be the last box
				// do not shift start
				boxes.push(b)
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
				boxes.push(b)
			}
			continue
		}
		console.log('unknown cigar: ' + cigar)
	}
	if (boxes.length == 0) {
		// no visible boxes, do not show this segment
		return
	}
	const segment = {
		qname,
		segstart,
		segstop: pos,
		boxes,
		forward: !(flag & 0x10),
		ridx,
		x1: r.x + r.scale(boxes[0].start),
		x2: r.x + r.scale(segmentstop(boxes)), // x stop position, for drawing connect line
		seq,
		qual,
		cigarstr,
		tlen,
		flag,
		tempscore
	}

	if (flag & 0x40) {
		segment.isfirst = true
	} else if (flag & 0x80) {
		segment.islast = true
	}

	if (rnext != '=' && rnext != '*' && rnext != r.chr) {
		// When mates are in different chromosome
		segment.rnext = rnext
		segment.pnext = pnext
	} else if (flag == 0 || flag == 16) {
		// in some cases star-mapped bam can have this kind of nonstandard flag
		// this is a temporary fix so that reads with 0 or 16 flag won't be labeled as discordant read (the last statement block)
	} else if (
		// // Mapped within insert size but incorrect orientation
		(flag & 0x1 && flag & 0x2 && flag & 0x10 && flag & 0x20 && flag & 0x40) || // 115
		(flag & 0x1 && flag & 0x2 && flag & 0x10 && flag & 0x20 && flag & 0x80) //179
	) {
		segment.discord_orientation = true
		if (keepmatepos) {
			// for displaying mate position (on same chr) in details panel
			segment.pnext = pnext
		}
	} else if (
		(flag & 0x1 && flag & 0x2 && flag & 0x20 && flag & 0x40) || // 99
		(flag & 0x1 && flag & 0x2 && flag & 0x10 && flag & 0x80) || // 147
		(flag & 0x1 && flag & 0x2 && flag & 0x10 && flag & 0x40) || // 83
		(flag & 0x1 && flag & 0x2 && flag & 0x20 && flag & 0x80) //163
	) {
		// Read and mate is properly paired
	} else if (flag & 0x8) {
		// Mate of read is unmapped
		segment.discord_unmapped2 = true
	} else if (
		(flag & 0x1 && flag & 0x10 && flag & 0x40 && segment.isfirst == true) || // 81 only if its the first segment of the template
		(flag & 0x1 && flag & 0x20 && flag & 0x80 && segment.islast == true) // 161 only if its the last segment of the template
		//(flag & 0x1 && flag & 0x10 && flag & 0x40 && segment.islast == true) || // 81 only if its the last segment of the template
		//(flag & 0x1 && flag & 0x20 && flag & 0x80 && segment.isfirst == true) // 161 only if its the first segment of the template
	) {
		// Discordant reads with wrong insert size where reads are oriented correctly
		//console.log('flag wrong insert size:', flag)
		//if (segment.isfirst) {
		//	console.log('segment.isfirst')
		//} else if (segment.islast) {
		//	console.log('segment.islast')
		//}
		segment.discord_wrong_insertsize = true
		if (keepmatepos) {
			// for displaying mate position (on same chr) in details panel
			segment.pnext = pnext
		}
	} else if (
		(flag & 0x1 && flag & 0x2 && flag & 0x40) || // 67
		(flag & 0x1 && flag & 0x2 && flag & 0x80) || // 131
		(flag & 0x1 && flag & 0x40) || // 65 (technically wrong insert size AND wrong orientation)
		(flag & 0x1 && flag & 0x80) // 129 (technically wrong insert size AND wrong orientation)
	) {
		// Mapped within insert size but incorrect orientation
		console.log('flag wrong orientation:', flag)
		if (segment.isfirst) {
			console.log('segment.isfirst')
		} else if (segment.islast) {
			console.log('segment.islast')
		}
		segment.discord_orientation = true
		if (keepmatepos) {
			// for displaying mate position (on same chr) in details panel
			segment.pnext = pnext
		}
	} else {
		// Discordant reads in same chr but not within the insert size
		console.log('flag wrong insert size:', flag)
		segment.discord_wrong_insertsize = true
		if (keepmatepos) {
			// for displaying mate position (on same chr) in details panel
			segment.pnext = pnext
		}
	}
	return segment
}

async function poststack_adjustq(group, q) {
	/*
call after stacking
control canvas height based on number of reads and stacks
set rendering parameters in q{}
based on stack height, to know if to render base quality and print letters
return number of stacks for setting canvas height

super high number of stacks will result in fractional row height and blurry rendering, no way to fix it now
*/
	const [a, b] = getstacksizebystacks(group.stacks.length, q)
	group.stackheight = a
	group.stackspace = b
	for (const r of group.regions) {
		r.to_printnt = group.stackheight > 7 && r.ntwidth >= 7
		r.to_qual = r.ntwidth >= minntwidth_toqual
	}
	if (group.stacks.length) {
		// has reads/templates for rendering, support below
		if (group.stackheight >= 7 && q.totalnumreads < 3000) {
			group.returntemplatebox = []
		} else {
			if (!group.partstack) {
				group.allowpartstack = true // to inform client
			}
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
	templates.sort((i, j) => i.x1 - j.x1) //group.templates
	group.stacks = [] // each value is screen pixel pos of each stack
	for (const template of templates) {
		// group.templates
		let stackidx = null
		if (!q.variant) {
			for (let i = 0; i < group.stacks.length; i++) {
				if (group.stacks[i] + q.stacksegspacing < template.x1) {
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

function plot_messagerows(ctx, group, q) {
	let y = 0
	for (const row of group.messagerows) {
		ctx.font = Math.min(12, row.h - 2) + 'pt Arial'
		ctx.fillStyle = 'black'
		ctx.fillText(row.t, q.canvaswidth / 2, y + row.h / 2)
		y += row.h
	}
	return y
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
			if (template.segments.length <= 1) continue
			template.height = getrowheight_template_overlapread(template, group.stackheight)
			stackrowheight[template.y] = Math.max(stackrowheight[template.y], template.height)
		}
	}
	const stacky = []
	let y = group.messagerows.reduce((i, j) => i + j.h, 0) + group.stackspace
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
				x2: Math.min(template.x2, r.width),
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
					// When read pairs are discordant exapanding past expected insert size and possibly in different chromosomes altogether
					box = {
						qname: template.segments[0].qname,
						x1: template.x1,
						x2: template.x2,
						y1: template.y,
						y2: template.y + (template.height || group.stackheight),
						start: Math.min(...template.segments.map(i => i.segstart)),
						stop: Math.max(...template.segments.map(i => i.segstop))
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
		if (prevseg.x2 <= seg.x1) {
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
	if (template.__tempscore != undefined && serverconfig.features.indel_kmer_scores) {
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
		if (b.opr == 'P' || b.opr == 'H') continue // do not handle
		if (b.opr == 'I') continue // do it next round
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
			ctx.moveTo(x, y2)
			ctx.lineTo(x + b.len * r.ntwidth, y2)
			ctx.stroke()
			if (group.stackheight > minstackheight2printbplenDN) {
				// b boundaries may be out of range
				const x1 = Math.max(0, x)
				const x2 = Math.min(r.width, x + b.len * r.ntwidth)
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
			if (r.to_qual) {
				let xoff = x
				b.qual.forEach(v => {
					if (segment.discord_unmapped2) {
						ctx.fillStyle = qual2discord_unmapped(v / maxqual)
					}
					//ctx.fillStyle = (segment.rnext ? qual2ctxpair : qual2match)(v / maxqual)
					ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					xoff += r.ntwidth
				})
			} else {
				// not showing qual, one box
				if (segment.discord_unmapped2) {
					ctx.fillStyle = discord_unmapped_hq
				}
				//ctx.fillStyle = segment.rnext ? ctxpair_hq : match_hq
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
					if (xoff + r.ntwidth + ntboxwidthincrement < r.width && xoff < r.width && r.x < xoff) {
						ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					}
					if (r.to_printnt) {
						ctx.fillStyle = 'white'
						if (xoff + r.ntwidth / 2 < r.width && xoff < r.width && r.x < xoff + r.ntwidth / 2) {
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
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement >= r.width && r.x < x) {
					ctx.fillRect(x, y, r.width - x, group.stackheight)
				}
			}
			continue
		}
		if (b.opr == 'M' || b.opr == '=') {
			// box
			if (r.to_qual) {
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
					//ctx.fillStyle = (segment.rnext ? qual2ctxpair : qual2match)(v / maxqual)
					if (xoff + r.ntwidth + ntboxwidthincrement < r.width && r.x < xoff) {
						ctx.fillRect(xoff, y, r.ntwidth + ntboxwidthincrement, group.stackheight)
					}
					xoff += r.ntwidth
				})
			} else {
				// not showing qual, one box
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
				//ctx.fillStyle = segment.rnext ? ctxpair_hq : match_hq
				if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && x < r.width && r.x < x + ntboxwidthincrement) {
					ctx.fillRect(x, y, b.len * r.ntwidth + ntboxwidthincrement, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement < r.width && r.x >= x) {
					ctx.fillRect(r.x, y, b.len * r.ntwidth + ntboxwidthincrement + x - r.x, group.stackheight)
				} else if (x + b.len * r.ntwidth + ntboxwidthincrement >= r.width && r.x < x) {
					ctx.fillRect(x, y, r.width - x, group.stackheight)
				}
			}
			if (r.to_printnt) {
				ctx.font = Math.min(r.ntwidth, group.stackheight - 2) + 'pt Arial'
				ctx.fillStyle = 'white'
				for (let i = 0; i < b.s.length; i++) {
					ctx.fillText(b.s[i], x + r.ntwidth * (i + 0.5), y + group.stackheight / 2)
				}
			}
			continue
		}
		throw 'unknown opr at rendering: ' + b.opr
	}

	if (group.stackheight >= minstackheight2strandarrow) {
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
			if (x >= 0) {
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

	if (segment.rnext) {
		if (!r.to_qual) {
			// no quality and just a solid box, may print name
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
	//else if (segment.discord_wrong_insertsize) {
	//	if (!r.to_qual) {
	//		// no quality and just a solid box, may print name
	//		if (segment.x2 - segment.x1 >= 20 && group.stackheight >= 7) {
	//			ctx.font = Math.min(insertion_maxfontsize, Math.max(insertion_minfontsize, group.stackheight - 4)) + 'pt Arial'
	//			ctx.fillStyle = 'white'
	//			ctx.fillText(
	//			    (q.nochr ? 'chr' : '')+q.regions[0].chr.replace('chr',''),
	//				(segment.x1 + segment.x2) / 2,
	//				y + group.stackheight / 2,
	//				segment.x2 - segment.x1
	//			)
	//		}
	//	}
	//}
}

function plot_insertions(ctx, group, q, templates, messagerowheights) {
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
		// plot a black v line under each position
		ctx.strokeStyle = insertion_vlinecolor
		for (const x of xpos) {
			ctx.beginPath()
			ctx.moveTo(x, messagerowheights)
			ctx.lineTo(x, group.canvasheight)
			ctx.stroke()
		}
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
				const text = b.s.length == 1 ? b.s : b.s.length
				// text y position to observe if the read is in an overlapping pair and shifted down
				ctx.fillText(text, x, template.y + group.stackheight * (segment.on2ndrow || 0) + group.stackheight / 2)
			}
		}
	}
}

function getcolorscale() {
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

	const canvas = createCanvas(
		leftpad + barwidth + rightpad,
		fontsize * 2 + labyspace + ticksize + (barheight + barspace) * 4
	)
	const ctx = canvas.getContext('2d')

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

	return canvas.toDataURL()
}

////////////////////// get one read/template

async function route_getread(genome, req) {
	// cannot use the point position under cursor to query, as if clicking on softclip
	if (!req.query.chr) throw '.chr missing'
	if (!req.query.qname) throw '.qname missing'
	req.query.qname = decodeURIComponent(req.query.qname) // convert %2B to +
	//if(!req.query.pos) throw '.pos missing'
	if (!req.query.start) throw '.start missing'
	if (!req.query.stop) throw '.stop missing'
	const r = {
		chr: req.query.chr,
		start: Number(req.query.start),
		stop: Number(req.query.stop),
		scale: () => {}, // dummy
		ntwidth: 10 // good to show all insertions
	}
	if (!Number.isInteger(r.start)) throw '.start not integer'
	if (!Number.isInteger(r.stop)) throw '.stop not integer'
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
	return { lst }
}

async function query_oneread(req, r) {
	let firstseg,
		lastseg,
		dir,
		e,
		_file,
		isurl,
		readstart,
		readstop,
		gdc_query = false
	if (req.get('x-auth-token')) gdc_query = true
	if (req.query.unknownorder) {
		// unknown order, read start/stop must be provided
		readstart = Number(req.query.readstart)
		readstop = Number(req.query.readstop)
		if (Number.isNaN(readstart) || Number.isNaN(readstop))
			throw 'readstart/stop not provided for read with unknown order'
	}
	if (!gdc_query) {
		;[e, _file, isurl] = app.fileurl(req)
		if (e) throw e
		dir = isurl ? await utils.cache_index(_file, req.query.indexURL || _file + '.bai') : null
	}
	return new Promise((resolve, reject) => {
		let ps
		if (gdc_query) {
			ps = spawn(samtools, ['view', path.join(serverconfig.cachedir, req.query.file)])
		} else {
			ps = spawn(
				samtools,
				[
					'view',
					_file,
					(req.query.nochr ? req.query.chr.replace('chr', '') : req.query.chr) + ':' + r.start + '-' + r.stop
				],
				{ cwd: dir }
			)
		}
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
			if (line.split('\t')[0] != req.query.qname) return
			const s = parse_one_segment({ sam_info: line, r, keepallboxes: true, keepmatepos: true, keepunmappedread: true })
			if (!s) return
			else if (req.query.show_unmapped && s.discord_unmapped2) return // Make sure the read being parse is mapped, especially in cases where the umapped mate is missing
			if (req.query.show_unmapped && req.query.getfirst) {
				// In case first read is mapped and second unmapped
				if (s.islast) {
					ps.kill()
					resolve([s])
					return
				}
			} else if (req.query.show_unmapped && req.query.getlast) {
				// In case first read is mapped and second unmapped
				if (s.isfirst) {
					ps.kill()
					resolve([s])
					return
				}
			} else if (req.query.getfirst) {
				if (s.isfirst) {
					ps.kill()
					resolve([s])
					return
				}
			} else if (req.query.getlast) {
				if (s.islast) {
					ps.kill()
					resolve([s])
					return
				}
			} else if (req.query.unknownorder) {
				if (s.segstart == readstart && s.segstop == readstop) {
					ps.kill()
					resolve([s])
					return
				}
			} else {
				// get both
				if (s.isfirst) firstseg = s
				else if (s.islast) lastseg = s
				if (firstseg && lastseg) {
					ps.kill()
					resolve([firstseg, lastseg])
					return
				}
			}
		})
		rl.on('close', () => {
			// finished reading and still not resolved
			// means it is in paired mode but read is single

			const lst = []
			if (firstseg) lst.push(firstseg)
			if (lastseg) lst.push(lastseg)
			resolve(lst.length ? lst : null)
		})
	})
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
	const reflst = ['<td>Reference</td>']
	const querylst = ['<td style="color:black;text-align:left">Read</td>']
	for (const b of seg.boxes) {
		if (b.opr == 'H') {
			continue
		}
		if (b.opr == 'I') {
			for (let i = b.cidx; i < b.cidx + b.len; i++) {
				reflst.push('<td>-</td>')
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
			continue
		}
		if (b.opr == 'D' || b.opr == 'N') {
			if (b.len >= 20) {
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
				querylst.push(
					'<td style="background:' +
						qual2softclipbg(quallst[b.cidx + i] / maxqual) +
						'">' +
						seg.seq[b.cidx + i] +
						'</td>'
				)
			}
			continue
		}
		if (b.opr == 'M' || b.opr == '=' || b.opr == 'X' || b.opr == '*') {
			for (let i = 0; i < b.len; i++) {
				const nt0 = refseq[b.start - refstart + i]
				const nt1 = seg.seq[b.cidx + i]
				reflst.push('<td>' + nt0 + '</td>')
				querylst.push(
					'<td style="background:' +
						(nt0.toUpperCase() == nt1.toUpperCase() ? qual2match : qual2mismatchbg)(quallst[b.cidx + i] / maxqual) +
						'">' +
						seg.seq[b.cidx + i] +
						'</td>'
				)
			}
			continue
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
				';color:white">Segments having wrong orientation</span>' +
				' mate position: ' +
				seg.pnext +
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
		alignment: `<table style="border-spacing:0px;border-collapse:separate;text-align:center">
			  <tr style="opacity:.6">${reflst.join('')}</tr>
			  <tr style="color:white">${querylst.join('')}</tr>
			</table>`,
		info: `<div style='margin-top:10px'>
			<span style="opacity:.5;font-size:.7em">START</span>: ${refstart + 1},
			<span style="opacity:.5;font-size:.7em">STOP</span>: ${refstop},
			<span style="opacity:.5;font-size:.7em">THIS READ</span>: ${refstop - refstart} bp,
			<span style="opacity:.5;font-size:.7em">TEMPLATE</span>: ${Math.abs(seg.tlen)} bp,
			<span style="opacity:.5;font-size:.7em">CIGAR</span>: ${seg.cigarstr}
			<span style="opacity:.5;font-size:.7em">NAME: ${seg.qname}</span>
		  </div>
		  <ul style='padding-left:15px'>${lst.join('')}</ul>`
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
