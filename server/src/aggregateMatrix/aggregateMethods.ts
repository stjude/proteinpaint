/** Return aggregate mean of numeric values in the array  */
export function getAggregate(data: unknown[]): number | null {
    const values = data.filter((v): v is number  => typeof v === 'number' && Number.isFinite(v))
    if (values.length === 0) return null
    const sum = values.reduce((acc, value) => acc + value, 0)
    return sum / values.length
}