// automatically get an HSL palette with a distinct color sequence,
// instead of looking like a linear chromatic scale
// TODO:
// - may move this to shared/utils
// - support a usedColors option that should not be reused in the generated color palette;
//   this would require something like https://github.com/Evercoder/d3-color-difference,
//   since two colors may still look very similar to each other even when not exactly the same
export function getHslPalette(numColors) {
	// These preassigned angles are the corners of equilateral triangle, inside
	// a 360 degree circle and touching it's circumference. The angle sequence
	// proceed in sequence of 3 distant colors (the triangle corners)
	// - after the first 3 angles, flip the triangle upside down
	// - then rotate to 270 which somewhat opposes 60
	// - then rotate to 15 which somewhat opposes 150
	const startAngles = [0, 120, 240, 180, 300, 60, 270, 30, 150, 15, 135, 255]
	// Keep saturation (70%) and lightness (50%) constant for consistency
	const presetColors = startAngles.map((hue, i) => `hsl(${hue},${i < 9 ? 70 : 40}%,${i < 9 ? 50 : 70}%)`)
	const colors = new Set(presetColors)
	const willCompute = numColors - colors.size
	if (willCompute <= 0) return [...colors]

	// after the startAngles are used up, reuse it but pad each angle with a given offset
	const huedelta = Math.trunc(360 / Math.max(30, Math.trunc(willCompute / 12))) // Divide 360° by unassigned colors
	let pad = 0
	while (colors.size < numColors) {
		pad += huedelta
		for (const [i, a] of startAngles.entries()) {
			const hsl = `hsl(${pad + a},${i < 9 ? 90 : 30}%,${i < 9 ? 40 : 60}%)`
			if (!colors.has(hsl)) colors.add(hsl)
		}
	}
	return [...colors].slice(0, numColors)
}
