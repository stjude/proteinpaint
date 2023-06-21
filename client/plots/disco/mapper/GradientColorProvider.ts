export default class GradientColorProvider {
    static provide(value: number): string {
        const clampedValue = Math.min(Math.max(value, 0), 1);

        const colorValue = Math.round(clampedValue * 255);

        return `rgb(${colorValue}, ${colorValue}, ${colorValue})`;
    }
}