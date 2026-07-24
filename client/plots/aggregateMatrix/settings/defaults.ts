import type { AggregateMatrixSettings } from './Settings.ts'

export function getDefaultAggregateMatrixSettings(): AggregateMatrixSettings {
    return {
        startColor: '#eb5f0e',
        stopColor: '#072b94',
        gradientMethod: 'mean',
        sizeMethod: 'mean'
    }
}