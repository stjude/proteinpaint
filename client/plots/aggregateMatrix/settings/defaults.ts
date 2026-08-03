import type { AggregateMatrixSettings } from './Settings.ts'

export function getDefaultAggregateMatrixSettings(): AggregateMatrixSettings {
    return {
        startColor: '#f78745',
        stopColor: '#2076BB',
        gradientMethod: 'mean',
        sizeMethod: 'mean',
        minDotSize: 5,
        maxDotSize: 20
    }
}