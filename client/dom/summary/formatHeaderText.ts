/** Consistently display text in the sandbox with the same formatting across charts.
 * Standardize the rendering and coding. 
 * 
 * TODO: May move to PlotBase? */
export default function formatHeaderText(arg): void {
    if (!arg.header) throw new Error('Header element is required')
    if (!arg.chartType) throw new Error('Chart type is required')

    if (arg.text) {
        if (!arg.prefix) arg.prefix = ''
        if (!arg.suffix) arg.suffix = ''
        arg.header.append('span')
            .style('margin-right', '5px')
            .text(`${arg.prefix}${arg.text}${arg.suffix}`)
    }

    arg.header.append('span')
        .style('font-size', '0.85em')
        .style('opacity', '0.8')
        .text(arg.chartType.toUpperCase())
}