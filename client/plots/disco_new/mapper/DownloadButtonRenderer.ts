export default class DownloadButtonRenderer {
    private downloadClickListener: (svg: any) => void;

    constructor(downloadClickListener: (svg: any) => void) {
        this.downloadClickListener = downloadClickListener
    }

    render(holder: any) {
        holder
            .append('button')
            .style('margin', '2px 0')
            .text('Download')
            .on('click', () => {
                const svg = holder.selectAll("svg").node()
                this.downloadClickListener(svg)

            })
    }
}