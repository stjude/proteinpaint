import { GeneSetEditUIwithTabs } from '../GeneSetEditUIwithTabs'
import tape from 'tape'
import { select } from 'd3-selection'
import { hg38 } from '../../../test/testdata/genomes'

/*************************
 reusable helper functions
**************************/
function getHolder() {
	return select('body').append('div').style('max-width', '800px').style('border', '1px solid #555')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- dom/GeneSetEdit/GeneSetEditUIwithTabs unit -***-')
	test.end()
})

tape('setTopGenes', async test => {
	test.timeoutAfter(100)
	const param = { label: 'Param 1', type: 'number', value: 10 }
	const topMutatedGenes = JSON.stringify(['aaa', 'bbb', 'ccc'])
	const topVariablyExpressedGenes = JSON.stringify(['xxx', 'yyy', 'zzz'])
	const vocabApi = {
		getTopGenes: () => [],
		termdbConfig: {
			queries: { topMutatedGenes: { arguments: [param] } }
		},
		getTopMutatedGenes: () => ({ genes: JSON.parse(topMutatedGenes) }),
		getTopVariablyExpressedGenes: () => ({ genes: JSON.parse(topVariablyExpressedGenes) })
	} //Fake vocab api returning  some genes

	const holder: any = getHolder()
	const defaultMode = 'geneVariant'
	const ui = new GeneSetEditUIwithTabs({
		mode: defaultMode,
		holder,
		genome: hg38,
		callback: () => {
			//comment so ts-linter doesn't complain
		},
		vocabApi,
		geneList: []
	})
	test.equal(ui.mode, defaultMode, `should have the expected default mode='${defaultMode}'`)
	{
		const message = `should give the expected top mutated genes`
		ui.callback = (result: any) => {
			test.deepEqual(result, { geneList: JSON.parse(topMutatedGenes).map(gene => ({ gene })) }, message)
		}
		try {
			await ui.setTopGenes(10)
		} catch (e) {
			test.fail(message + ': ' + e)
		}
	}

	ui.mode = 'geneExpression'
	{
		const message = `should give the expected top mutated genes`
		ui.callback = (result: any) => {
			test.deepEqual(result, { geneList: JSON.parse(topVariablyExpressedGenes).map(gene => ({ gene })) }, message)
		}
		try {
			await ui.setTopGenes(10)
		} catch (e) {
			test.fail(message + ': ' + e)
		}
	}

	if (test['_ok']) {
		holder.remove()
		ui.api.destroy()
	}
	test.end()
})
