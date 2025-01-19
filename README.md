# Introduction

Snyk crawler exercise submission using JavaScript, worker threads, NodeJS and CSV library.

## Requirements

- NodeJS

## Generating input data

run the command:

`npm run generateCsvExample`

if needed, change `DOMAINS` or `PATHS` to add other websites or paths to check.

## Running the application

run the command:

`npm run start -- --csv-path <some csv path>`


- Notice the '--' before the CLI option, it is required!
- The application defaults to running the './csvExample.csv'  file, but if needed you can leverage the option `--csv-path` to pass another CSV path that comply with the required structure

