import tape from 'tape'
import { PseudobulkBase } from '../pseudobulk.ts'
import { PSEUDOBULK } from '#shared/terms.js'

/*************************
 reusable helper functions
**************************/

function getValidRawTerm(opts: any = {}) {
    return Object.assign({}, {
        type: PSEUDOBULK,
        assay: 'geneExpression',
        memberId: 'Cell Type',
    }, opts)
}

/**************
 test sections
***************/

tape('\n', function (test) {
    test.comment('-***- tw/pseudobulk.unit -***-')
    test.end()
})

tape('validate() should throw on invalid terms', test => {
    test.throws(
        () => PseudobulkBase.validate(null as any),
        /term is not an object/,
        'Should throw when term is not an object.'
    )

    test.throws(
        () => PseudobulkBase.validate({ type: 'categorical' } as any),
        /incorrect term.type='categorical'/,
        'Should throw when term.type is incorrect.'
    )

    test.throws(
        () => PseudobulkBase.validate(getValidRawTerm({ assay: undefined }) as any),
        /term.assay is missing or invalid/,
        'Should throw when term.assay is missing.'
    )

    test.throws(
        () => PseudobulkBase.validate(getValidRawTerm({ assay: 'badAssay' }) as any),
        /term.assay is missing or invalid/,
        'Should throw when term.assay is invalid.'
    )

    test.throws(
        () => PseudobulkBase.validate(getValidRawTerm({ memberId: undefined }) as any),
        /term.memberId is missing or not a string/,
        'Should throw when term.memberId is missing.'
    )

    test.throws(
        () => PseudobulkBase.validate(getValidRawTerm({ memberId: 123 }) as any),
        /term.memberId is missing or not a string/,
        'Should throw when term.memberId is not a string.'
    )

    test.doesNotThrow(
        () => PseudobulkBase.validate(getValidRawTerm() as any),
        'Should accept a valid pseudobulk term.'
    )

    test.end()
})

tape('fill() should return the raw term when valid', test => {
    const term = getValidRawTerm()
    const out = PseudobulkBase.fill(term as any)

    test.equal(out, term, 'Should return the same raw term reference.')
    test.end()
})

tape('fill() should no-op for class instances', test => {
    const instance = new PseudobulkBase(getValidRawTerm() as any)

    test.doesNotThrow(
        () => PseudobulkBase.fill(instance as any),
        'Should not throw when fill is called on a class instance.'
    )

    test.equal(
        PseudobulkBase.fill(instance as any),
        undefined,
        'Should return undefined when fill is called on a class instance.'
    )
    test.end()
})

tape('constructor should set explicit term fields', test => {
    const term = getValidRawTerm({ assay: 'geneExpression', memberId: 'B Cell' })
    const x = new PseudobulkBase(term as any)

    test.equal(x.type, PSEUDOBULK, 'Should set type.')
    test.equal(x.assay, 'geneExpression', 'Should set assay.')
    test.equal(x.memberId, 'B Cell', 'Should set memberId.')
    test.end()
})

tape('constructor should throw on invalid terms', test => {
    test.throws(
        () => new PseudobulkBase(getValidRawTerm({ assay: 'badAssay' }) as any),
        /term.assay is missing or invalid/,
        'Should throw when constructor receives an invalid assay.'
    )

    test.throws(
        () => new PseudobulkBase(getValidRawTerm({ memberId: undefined }) as any),
        /term.memberId is missing or not a string/,
        'Should throw when constructor receives a missing memberId.'
    )

    test.end()
})