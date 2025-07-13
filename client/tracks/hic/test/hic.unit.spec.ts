import tape from 'tape'
import { hicstrawfromtemplate } from '../../../src/block.tk.hicstraw.adaptor.ts'
import { hicstrawmaketk } from '../../../src/block.tk.hicstraw.adaptor.ts'

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

tape('\n', test => {
	test.comment('-***- tracks/hic unit-***-')
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
