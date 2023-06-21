import GradientColorProvider from "#plots/disco/mapper/GradientColorProvider";

export default class LohLegend {
    minValue: number
    maxValue: number
    colorStartValue: string
    colorEndValue: string
    constructor(minValue: number, maxValue: number) {
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.colorStartValue = GradientColorProvider.provide(minValue);
        this.colorEndValue = GradientColorProvider.provide(maxValue);
    }
}