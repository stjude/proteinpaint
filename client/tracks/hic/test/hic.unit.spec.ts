import tape from 'tape'
import { hicstrawfromtemplate } from '../../../src/block.tk.hicstraw.adaptor.ts'
import { hicstrawmaketk } from '../../../src/block.tk.hicstraw.adaptor.ts'
import { Positions } from '../data/Positions.ts'

/*
Tests:
	hicstrawfromtemplate() from hicstraw.adaptor
	hicstrawmaketk() from hicstraw.adaptor
 */

/** Types are scoped to file. May move to client/types later when there's a plan
 * in place for track and maybe block types*/
type Tk = {
	textdata?: {
		/** number added to test logic but string is the only acceptable type */
		raw?: string | number
	}
	hic?: {
		enzyme?: string
	}
	enzyme?: string
	uninitialized?: boolean
}

type Template = {
	domainoverlay?: {
		file?: string
		url?: string
	}
	file?: string
	enzyme?: string
}

const mockHic = {
	genome: {
		chrlookup: {
			CHR1: { len: 243199373, name: 'chr1' },
			CHR2: { len: 249250621, name: 'chr2' }
		}
	},
	bpresolution: [2500000, 1000000, 500000, 250000, 100000, 50000, 25000, 10000, 5000]
}

tape('\n', test => {
	test.pass('-***- tracks/hic unit-***-')
	test.end()
})

tape('hicstrawfromtemplate() from hicstraw.adaptor', test => {
	test.plan(5)

	let tk: Tk, template: Template, result: string | null, message: string

	//Blank .raw and no bedfile or bedurl or templatefile or templateurl
	message = `Should return for missing textdata.raw message`
	tk = { textdata: {} }
	template = {}
	result = hicstrawfromtemplate(tk, template)
	test.equal(result, '.textdata.raw missing', message)

	//Wrong type
	message = `Should return for textdata.raw not a string message`
	tk = { textdata: { raw: 1 } }
	result = hicstrawfromtemplate(tk, template)
	test.equal(result, '.textdata.raw should be string', message)

	//No data provided
	message = `Should return for no data sources message`
	tk = {}
	result = hicstrawfromtemplate(tk, template)
	test.equal(result, 'none of the data sources available: text data, bedj file, or juicebox file', message)

	//Domainoverlay missing file and url
	message = `Should return for missing domainoverlay file or url message`
	tk = { textdata: { raw: 'test' } }
	template = { domainoverlay: {} }
	result = hicstrawfromtemplate(tk, template)
	test.equal(result, 'file or url missing for domainoverlay', message)

	//Add enzyme to hic object
	message = `Should add enzyme from template to hic object`
	template = { file: 'test/file/path', enzyme: 'MboI' }
	tk = { hic: { enzyme: 'DpnII' }, enzyme: 'DpnII' }
	result = hicstrawfromtemplate(tk, template)
	test.equal(tk.hic!.enzyme, template.enzyme, message)
})

tape('hicstrawmaketk() from hicstraw.adaptor', test => {
	test.plan(1)
	const tk = {} as Tk
	hicstrawmaketk(tk)
	test.ok(tk.uninitialized, 'Should add uninitialized to tk')
})

tape('Positions - setPositions()', test => {
	const mockError = () => []
	const positions = new Positions(mockError)
	const chrx = { chr: 'chr1' }
	const chry = { chr: 'chr2' }

	let result: any

	test.ok(positions instanceof Positions, 'Should construct class properly')
	test.equal(positions.error, mockError, 'Should set error lst correctly')

	result = positions.setPosition(260.12890625, 62.7734375, 3, chrx, chry, mockHic)
	test.deepEqual(
		result,
		[
			{ chr: 'chr1', start: 76709635, stop: 96709635 },
			{ chr: 'chr2', start: 10924479, stop: 30924479 }
		],
		'Should set position correctly'
	)

	//Out of bounds
	result = positions.setPosition(1000, 1000, 3, chrx, chry, mockHic)
	test.deepEqual(
		result,
		[
			{ chr: 'chr1', start: 223199373, stop: 243199373 },
			{ chr: 'chr2', start: 229250621, stop: 249250621 }
		],
		'Should handle out of bounds positions'
	)

	test.end()
})
