/** Consistently display text in the sandbox with the same formatting across charts.
 * Standardize styling and text formatting. 
 * 
 * TODO: 
 * 1. May move to PlotBase? 
 * 2. update() if necessary */

type FormatHeaderTextArg = {
    /** Sandbox header */
    header: any
    chartType: string
    /** term name, sample Id, etc.  */
    text?: string
    prefix?: string
    suffix?: string
}

export default function formatHeaderText(arg: FormatHeaderTextArg): void {
    if (!arg.header) throw new Error('Header element is required')
    if (!arg.chartType) throw new Error('Chart type is required')

    arg.header.attr('data-testid', `sjpp-header-${arg.chartType}`)

    if (arg.text) {
        if (!arg.prefix) arg.prefix = ''
        if (!arg.suffix) arg.suffix = ''
        const joinedText = [arg.prefix, arg.text, arg.suffix].join(' ') 
        arg.header.append('span')
            .attr('data-testid', `sjpp-header-text-${arg.chartType}`)
            .style('margin-right', '5px')
            .text(joinedText)
    }

    arg.header.append('span')
        .style('font-size', '0.8em')
        .style('opacity', '0.8')
        .text(arg.chartType.toUpperCase())
}