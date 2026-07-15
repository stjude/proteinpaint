import tape from 'tape'

/** FOR DEVELOPMENT ONLY */

tape('\n', function (test) {
    test.comment('-***- tw/pseudobulk.unit -***-')
    test.end()
})

tape('** Development Default term **', function (test) {
    test.timeoutAfter(100)
    //TODO: add more tests for pseudobulk term
    // const tw = new PseudobulkBase(
    //     { id: 'B', name: 'B', type: 'pseudobulk', assay: 'geneExpression', memberId: 'Cell Type' },
    // )
    test.end()
})


