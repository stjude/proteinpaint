import type { AggregateMatrix } from '../AggregateMatrix.ts'
import type { AggMatrixViewData } from '../viewModel/ViewModelDataTypes.ts'
import { ColorScale, LegendCircleReference, capitalizeFirstLetter} from '#dom'
import { rgb } from 'd3-color'
import { validateMinMax } from '../settings/defaults.ts'

export class LegendRender {
    ag: AggregateMatrix

    constructor(ag: AggregateMatrix) {
        this.ag = ag
    }

    render(viewData: AggMatrixViewData, div: any) {
        const settings = this.ag.state.config.settings.aggregateMatrix
        const colorScaleSvg = div.append('svg').style('display', 'block')
        const dotScaleSvg = div.append('svg').style('display', 'block')
        this.renderColorScale(viewData.colorScale, settings, colorScaleSvg)
        this.renderDotScaleRef(dotScaleSvg, settings)
    }

    renderColorScale(colorScale, settings, svg) {
        svg.append('text').attr('x', 10).attr('y', 20).text(capitalizeFirstLetter(settings.gradientMethod))
        new ColorScale({
            holder: svg,
            domain: colorScale.scale.domain(),
            colors: [settings.startColor, settings.stopColor],
            barheight: 20,
            barwidth: 200,
            position: '10, 30',
            setColorsCallback: (val, idx) => {
                const hexColor = rgb(val).formatHex()
                const colorKey = idx == 0 ? 'startColor' : 'stopColor'
                this.ag.app.dispatch({
                    type: 'plot_edit',
                    id: this.ag.id,
                    config: {
                        settings: {
                            aggregateMatrix: {
                                [colorKey]: hexColor
                            }
                        }
                    }
                })
            },
            //Disable for now. Need to know if this appropriate.
        //     numericInputs: {
        //         cutoffMode: settings.cutoffMode,
        //         callback: (obj) => {
        //             if (!obj) return
        //             const { min, max, cutoffMode } = obj
        //             let newMin, newMax
        //             if (cutoffMode === 'auto') {
        //                 newMin = colorScale.absMin
        //                 newMax = colorScale.absMax
        //             }
        //             if (cutoffMode === 'fixed') {
        //                 newMin = min
        //                 newMax = max
        //             }
        //             this.ag.app.dispatch({
        //                 type: 'plot_edit',
        //                 id: this.ag.id,
        //                 config: {
        //                     settings: {
        //                         aggregateMatrix: {
        //                             cutoffMode,
        //                             min: newMin,
        //                             max: newMax
        //                         }
        //                     }
        //                 }
        //             })
        //         }
        //     }
        })
    }

    renderDotScaleRef(svg, settings) {
        svg.append('text')
            .attr('x', 10)
            .attr('y', 20)
            .style('display', 'block')
            .text(capitalizeFirstLetter(settings.sizeMethod))

        const g = svg.append('g')
        new LegendCircleReference({
            g,
            inputMax: settings.dotInputMax,
            inputMin: settings.dotInputMin,
            maxRadius: settings.maxDotSize,
            minRadius: settings.minDotSize,
            isAscending: true,
            x: 40 + settings.maxDotSize,
            y: 40 + settings.maxDotSize,
            menu: {
				callback: async (obj: { min: number; max: number }) => {
                    const { min, max } = obj
                    const isValid = validateMinMax(settings, min, max)
                    if (isValid !== null) {
                        alert(isValid)
                        return
                    }
					this.ag.app.dispatch({
                        type: 'plot_edit',
                        id: this.ag.id,
                        config: {
                            settings: {
                                aggregateMatrix: {
                                    minDotSize: min,
                                    maxDotSize: max
                                }
                            }
                        }
                    })
				}
			}
        })
    }
}