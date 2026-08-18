import type { AggregateMatrixSettings } from './Settings.ts'

export function getAggregateMatrixSettings(overrides = {}): AggregateMatrixSettings {
    const defaults = {
        startColor: '#ff9400',
        stopColor: '#0080ff',
        gradientMethod: 'mean',
        sizeMethod: 'percent',
        minDotSize: 5,
        maxDotSize: 20,
        dotInputMin: 2,
        dotInputMax: 35
    }

    const mergedSettings = Object.assign({}, defaults, overrides)
    const isValidMinMax = validateMinMax(mergedSettings, mergedSettings.minDotSize, mergedSettings.maxDotSize)
    if (isValidMinMax !== null) {
        throw new Error(`Invalid min/max dot size settings: ${isValidMinMax}`)
    }

    return mergedSettings
}

export function validateMinMax(settings: AggregateMatrixSettings, min, max): string | null {
    if (min < settings.dotInputMin) {
        return `Minimum dot size must be greater than or equal to ${settings.dotInputMin}`
    }
    if (max > settings.dotInputMax) {
        return `Maximum dot size must be less than or equal to ${settings.dotInputMax}`
    }
    if (min > max) {
        return `Minimum dot size must be less than or equal to maximum dot size`
    }
    return null
}