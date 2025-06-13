import test from 'tape'
import CnvColorProvider from '../CnvColorProvider'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'

/*
Tests:
	CnvColorProvider.getColor returns the expected color
	based on CNV value, rendering mode, and capping thresholds.
*/

// ───── Mock Settings ─────

// Mock settings for heatmap mode
// In this mode, capping values are taken from settings.Disco.cnvCapping
const mockSettingsHeatmap = {
	cnv: {
		cappedLossColor: 'blue', // Color for values below the loss cap
		lossColor: 'lightblue', // Color for loss values within -cap and 0
		ampColor: 'lightred', // Color for gain values within 0 and +cap
		cappedAmpColor: 'red' // Color for values above the gain cap
	},
	Disco: {
		cnvRenderingType: CnvRenderingType.heatmap, // Rendering type is heatmap
		cnvCapping: 2 // Capping threshold is 2
	}
} as any

// Mock settings for non-heatmap mode
// In this mode, capping values are passed as cnvMaxPercentileAbs
const mockSettingsNonHeatmap = {
	cnv: {
		cappedLossColor: 'blue',
		lossColor: 'lightblue',
		ampColor: 'lightred',
		cappedAmpColor: 'red'
	},
	Disco: {
		cnvRenderingType: 'non-heatmap' // Use external cnvMaxPercentileAbs for thresholds
	}
} as any

test('\n', function (t) {
	t.pass('-***- client/plots/disco/cnv/CnvColorProvider.ts -***-')
	t.end()
})

// ───── Unit Tests: Heatmap Mode ─────
// Verifies behavior when rendering type is heatmap
// Uses internal settings.Disco.cnvCapping as threshold

test('CnvColorProvider.getColor - heatmap mode', t => {
	// Test value below loss threshold (should return cappedLossColor)
	t.equal(
		CnvColorProvider.getColor(-3, mockSettingsHeatmap),
		mockSettingsHeatmap.cnv.cappedLossColor,
		`Capped loss should return cappedLossColor (${mockSettingsHeatmap.cnv.cappedLossColor})`
	)

	// Test value within negative range (should return lossColor)
	t.equal(
		CnvColorProvider.getColor(-1, mockSettingsHeatmap),
		mockSettingsHeatmap.cnv.lossColor,
		`In-range loss should return lossColor (${mockSettingsHeatmap.cnv.lossColor})`
	)

	// Test value within positive range (should return ampColor)
	t.equal(
		CnvColorProvider.getColor(1, mockSettingsHeatmap),
		mockSettingsHeatmap.cnv.ampColor,
		`In-range gain should return ampColor (${mockSettingsHeatmap.cnv.ampColor})`
	)

	// Test value above gain threshold (should return cappedAmpColor)
	t.equal(
		CnvColorProvider.getColor(3, mockSettingsHeatmap),
		mockSettingsHeatmap.cnv.cappedAmpColor,
		`Capped gain should return cappedAmpColor (${mockSettingsHeatmap.cnv.cappedAmpColor})`
	)
	t.end()
})

// ───── Unit Tests: Non-Heatmap Mode ─────
// Verifies behavior when rendering type is not heatmap
// Uses provided cnvMaxPercentileAbs value as threshold

test('CnvColorProvider.getColor - non-heatmap mode with cnvMaxPercentileAbs', t => {
	const cap = 1.5 // external capping threshold

	// Test value below -cap (should return cappedLossColor)
	t.equal(
		CnvColorProvider.getColor(-2, mockSettingsNonHeatmap, cap),
		mockSettingsNonHeatmap.cnv.cappedLossColor,
		`Capped loss should return cappedLossColor (${mockSettingsNonHeatmap.cnv.cappedLossColor})`
	)

	// Test value between -cap and 0 (should return lossColor)
	t.equal(
		CnvColorProvider.getColor(-1, mockSettingsNonHeatmap, cap),
		mockSettingsNonHeatmap.cnv.lossColor,
		`In-range loss should return lossColor (${mockSettingsNonHeatmap.cnv.lossColor})`
	)

	// Test value between 0 and cap (should return ampColor)
	t.equal(
		CnvColorProvider.getColor(1, mockSettingsNonHeatmap, cap),
		mockSettingsNonHeatmap.cnv.ampColor,
		`In-range gain should return ampColor (${mockSettingsNonHeatmap.cnv.ampColor})`
	)

	// Test value above cap (should return cappedAmpColor)
	t.equal(
		CnvColorProvider.getColor(2, mockSettingsNonHeatmap, cap),
		mockSettingsNonHeatmap.cnv.cappedAmpColor,
		`Capped gain should return cappedAmpColor (${mockSettingsNonHeatmap.cnv.cappedAmpColor})`
	)
	t.end()
})
