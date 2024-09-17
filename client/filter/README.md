# Filter UI

## Usage

Import one of these from `filter.js` or directly from a filter class file:

- `filterInit()`: use in non-rx apps where tag='filterUiRoot' is not used
- `filterPromptInit()`: use in non-rx apps where tag='filterUiRoot' is used
- `filterRxCompInit()`: use a component in rx-apps, such as mass UI tab


## API

The API is [documented here](https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.drzmh395uarf).

## Tests

- Using a browser: http://localhost:3000/testrun.html?dir=filter

- Command line: `./test.sh filter.*.spec.*`
