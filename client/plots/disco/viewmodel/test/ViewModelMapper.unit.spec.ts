import test from 'tape'
import { ViewModelMapper } from '../ViewModelMapper'
import discoDefaults from '../../defaults'

/*
Tests:
ViewModelMapper scales rings and dimensions using the radius setting
*/



const settings = discoDefaults({ Disco: { radius: 500 } })
const mapper = new ViewModelMapper(settings as any, {} as any)

const opts = {
    args: {
        chromosomes: undefined,
        genome: { majorchr: { chr1: 1000 }, geneset: [] },
        sampleName: 'Sample',
        data: []
    }
}

const viewModel = mapper.map(opts)

test('\n', function (t) {
    t.pass('-***- plots/disco/viewmodel/ViewModelMapper -***-')
    t.end()
})

test('ViewModelMapper.applyRadius adjusts settings and ViewModel dimensions', t => {
    t.equal(
        viewModel.settings.rings.labelLinesInnerRadius,
        500,
        'Label lines inner radius should match radius setting'
    )

    t.ok(
        Math.abs(viewModel.settings.rings.chromosomeInnerRadius - 452) < 1,
        'Chromosome inner radius scales with radius'
    )

    t.ok(
        Math.abs(viewModel.settings.label.fontSize - 28.57) < 0.1,
        'Font size should scale with radius setting'
    )

    t.ok(
        Math.abs(viewModel.width - 2142.86) < 1,
        'Width should scale according to radius setting'
    )

    t.ok(
        Math.abs(viewModel.height - 1746.43) < 1,
        'Height should scale according to radius setting'
    )

    t.end()
})