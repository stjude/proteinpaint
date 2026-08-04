import type { AggregateMatrixSettings } from './Settings.ts'

export function getDefaultAggregateMatrixSettings(): AggregateMatrixSettings {
    return {
        startColor: '#ff9400',
        stopColor: '#0080ff',
        gradientMethod: 'mean',
        sizeMethod: 'mean',
        minDotSize: 5,
        maxDotSize: 20
    }
}