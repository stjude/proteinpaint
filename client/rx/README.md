# Rx Framework

## Introduction

Rx is a minimal reactive framework that borrows general ideas from React and Vue-related libraries. 

### Goals

These goals help developers become more productive and their code more readable:

1. Coordinate app and component updates, especially when changes to one or more components can be triggered by different events or parts of the code. This helps minimize messy code.
2. Enforce coding conventions, such as naming patterns and code interaction through immutable instance APIs
3. Simplify writing automated tests, especially for asynchronously rendered DOM elements, by having test helper functions that are framework-aware
4. Recover and replay state updates, for example to undo/redo or to save and restore user sessions

### Benefits

An application benefits from using rx by having:

- synchronized rendered data (from Goal #1): no mismatched totals, labels, or visualized data
- more stability and reliability (from Goal #3): less bugs and regressions from code changes
- well-known interaction patterns (from Goal #4): easier to discover features and customize visualizations, since configuration mistakes are easily undone and unfinished work can be recovered in later user sessions 

## Develop

### Usage

### Get started

```bash
git clone git@github.com:siosonel/rx.git
cd rx
npm install 
# npm test # TODO: fix standalone tests
# update code
# npm test
# open a Github PR
```

To see examples, open http://localhost:8080/ after launching a server:

```bash
node server.js 8080
```


## API

### Basic Overview

See a [highly simplified diagram](https://docs.google.com/drawings/d/14k2vuY0isgJzBY1BrEqiJfsl-9O6ewu3IsG-xEi4oCw/edit?usp=sharing) of the unidirectional data flow.

(TODO: fill-in this section)


### Detailed API

Please refer to the [detailed API documentation](https://docs.google.com/document/d/1G3LqbtsCEkGw4ABA_VognhjVnUHnsVYAGdXyhYG374M/edit?usp=sharing).