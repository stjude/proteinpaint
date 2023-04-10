class PlotElement {
    private startAzimuth: number
    private endAzimuth?: number
    constructor(startAzimuth: number, endAzimuth?: number) {
        this.startAzimuth = startAzimuth;
        this.endAzimuth = endAzimuth;
    }
}