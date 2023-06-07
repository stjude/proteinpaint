export default class LohLegend {
    minValue: number
    maxValue: number
    colorStartValue: string
    colorEndValue: string

    constructor(minValue: number, maxValue: number, colorStartValue: string, colorEndValue: string) {
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.colorStartValue = colorStartValue;
        this.colorEndValue = colorEndValue;
    }
}