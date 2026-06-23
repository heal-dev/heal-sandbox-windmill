import { test as base } from '@playwright/test'

export type Fx = {
  ns: string
}

export const test = base.extend<{ fx: Fx }>({
  fx: async ({}, use, testInfo) => {
    const ns = `w${testInfo.parallelIndex}-t${testInfo.testId.slice(0, 8)}`
    await use({ ns })
  },
})

export { expect } from '@playwright/test'
