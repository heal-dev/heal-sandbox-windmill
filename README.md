# Heal sandbox for Windmill

## Background

This is a sample testing sandbox with specs and tests generated on the open-source script orchestration platform [windmill](https://github.com/windmill-labs/windmill). It was created with Heal, an agent that turns your codebase into a production-like, testable sandbox, then tests the hell out of it.


## How to run tests

Tests are written in Playwright and can run independently of the heal agent. They use the [heal-playwright-tracer](https://github.com/heal-dev/heal-playwright-tracer) to provide better, easier-to-analyze tracers. To run:

1. Install dependencies `npm i`
2. Run tests `npx playwright test`

## How to add more test coverage 

Heal is building an opinionated QA engineer that:
- easily adds more test coverage
- tests the corner cases you don't think about or that are hard to test
- get bug reports with low false-positive to feed back to yourcoding agent
- makes your system testable even when it has complicated architectures and integration points

➡️ [Get early access to heal](https://www.heal.dev/). Mention this repo to get fast-tracked!
<img width="1800" height="1130" alt="Screenshot 2026-07-02 at 11 38 43" src="https://github.com/user-attachments/assets/37c6c9c4-4ff0-474d-8c35-abf145257703" />

## Results

A fast, naive pass of heal found 2 bugs and many visual defects.
