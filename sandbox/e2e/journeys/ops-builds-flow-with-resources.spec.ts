import { test, expect } from '../data/fixtures'
import { API_BASE, FRONTEND_URL, SEED } from '../../config'
import { loginAdmin } from '../helpers/workspaceApi'
import {
  createResource,
  createVariable,
  deleteResource,
  deleteResourceType,
  deleteVariable,
  ensureSimpleResourceType,
} from '../helpers/varResApi'
import { createScriptViaApi, tryDeleteScriptViaApi } from '../helpers/scriptsApi'
import { createFlowViaApi, tryDeleteFlowViaApi } from '../helpers/flowsApi'
import { createHttpRouteViaApi, tryDeleteHttpRouteViaApi } from '../helpers/triggersApi'

// Journey: An ops engineer wires Resource + Variable -> Script -> Flow -> HTTP
// route, fires the route, and inspects the resulting job in /runs + /run/<id>.
//
// Per the spec walkNote concessions, several steps are API-shortcutted because
// the Windmill UI surfaces (Monaco editor for script body, FlowBuilder
// drag-drop, RouteEditor drawer, and the act of firing a route — there is no
// /routes UI affordance for firing) are too fragile or non-existent to walk
// reliably. UI assertions still anchor every step.
//
// State accretes through the test: resourcePath -> variablePath -> scriptPath
// -> flowPath -> routePath -> jobId. Cleanup unwinds in reverse order in the
// finally block.

const WID = SEED.workspace.id

// HTTP_ROUTERS_CACHE refreshes every 60s; route fire must retry on 404 for
// ~60s after the route create (walk found 3 attempts at ~3s spacing was
// enough, but allow generous budget).
const fireRouteWithRetry = async (
  request: import('@playwright/test').APIRequestContext,
  cookie: string,
  routePathSeg: string,
): Promise<{ status: number; body: string }> => {
  const url = `${API_BASE}/r/${WID}/${routePathSeg}`
  const deadline = Date.now() + 75_000
  let lastStatus = 0
  let lastBody = ''
  while (Date.now() < deadline) {
    const res = await request.post(url, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: {},
    })
    lastStatus = res.status()
    lastBody = await res.text()
    if (res.ok()) return { status: lastStatus, body: lastBody }
    if (lastStatus !== 404) break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  return { status: lastStatus, body: lastBody }
}

test.describe('@journey @journey:ops-builds-flow-with-resources @worker ops-builds-flow-with-resources', () => {
  test.describe.configure({ mode: 'serial' })

  test('Ops engineer wires resource+variable+script into a flow fired by an HTTP route', async ({
    page,
    request,
    fx,
  }, testInfo) => {
    testInfo.setTimeout(300_000)

    const slug = fx.ns.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24)
    const resourceTypeName = `c_ops_cfg_${slug}`.replace(/[^a-z0-9_]/g, '_').slice(0, 28)
    const resourcePath = `u/admin/ops-cfg-${slug}`
    const variableSuffix = `ops-var-${slug}`
    const variablePath = `u/admin/${variableSuffix}`
    const scriptPath = `u/admin/ops-script-${slug}`
    const flowPath = `u/admin/ops-flow-${slug}`
    const routeAdminPath = `u/admin/ops-route-${slug}`
    const routePathSeg = `ops-${slug}`

    const auth = await loginAdmin(request)
    await page.addInitScript(() => {
      try { localStorage.setItem('workspace', 'admins') } catch {}
    })

    // Defensive cleanup of any leftover artifacts from a previous run.
    await tryDeleteHttpRouteViaApi(request, auth, routeAdminPath).catch(() => {})
    await tryDeleteFlowViaApi(request, auth, flowPath).catch(() => {})
    await tryDeleteScriptViaApi(request, auth, scriptPath).catch(() => {})
    await deleteVariable(request, auth, variablePath).catch(() => {})
    await deleteResource(request, auth, resourcePath).catch(() => {})
    await deleteResourceType(request, auth, resourceTypeName).catch(() => {})

    let jobId = ''

    try {
      // ===== Setup: seed a c_config-shaped resource type =====
      // The seeded 'admins' workspace ships with zero resource_types, so the
      // /resources -> "Add resource" UI flow cannot pick a type until one
      // exists. Walk-confirmed divergence; pre-seed via API.
      await test.step('setup: seed a c_config-shaped resource type via API', async () => {
        const res = await request.post(
          `${API_BASE}/w/${WID}/resources/type/create`,
          {
            headers: { Cookie: auth.cookie, 'Content-Type': 'application/json' },
            data: {
              name: resourceTypeName,
              schema: {
                type: 'object',
                properties: { region: { type: 'string' } },
                required: ['region'],
              },
              description: 'ops journey resource type',
            },
          },
        )
        // Tolerate "already exists" from a leaked prior run.
        if (!res.ok()) {
          const t = await res.text()
          if (!/already/i.test(t)) {
            throw new Error(`resource type seed failed: ${res.status()} ${t}`)
          }
        }
      })

      // ===== Step 1: /resources -> create a resource via the UI =====
      await test.step('step 1: create a resource via /resources UI', async () => {
        await page.goto(`${FRONTEND_URL}/resources`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible({ timeout: 30_000 })

        // Two CTAs exist on this page: "Add resource type" and "Add resource".
        // Anchor on the exact label for the latter.
        await page.getByRole('button', { name: /^Add resource$/ }).first().click()

        // The drawer surfaces a resource-type picker (combobox/searchable).
        // Walk found the picker variant is a combobox or a search field.
        const typeCombo = page
          .getByRole('combobox', { name: /resource type|type/i })
          .first()
          .or(page.getByPlaceholder(/resource type|type/i).first())
        await typeCombo.click().catch(() => {})
        await typeCombo.fill(resourceTypeName).catch(() => {})
        await page.getByText(resourceTypeName, { exact: false }).first().click()

        // After type-pick the drawer shows "Add a resource" with a suffix-only
        // path input (u / admin / <slug>) pre-filled with a Windmill-generated
        // random name. The input has no aria-label — locate it by being the
        // only textbox in the path row (preceded by the 'u' segment dropdown
        // and 'admin' static text). Clear via triple-click + type.
        // Path input is `<input id="path">` (Path.svelte:531) with no
        // associated label and a placeholder defaulting to the type name.
        const pathInput = page.locator('input#path').first()
        await pathInput.click({ clickCount: 3 })
        await pathInput.pressSequentially(`ops-cfg-${slug}`)

        // Wait for the type-picker dropdown to clear off the SchemaForm field
        // (~1s overlay race) before interacting.
        await page.waitForTimeout(1500)

        // Schema field `region` — SchemaForm → ArgInput → TextInput renders a
        // <textarea> with `use:autosize` that resizes on every input, racing
        // Playwright's `.fill()` stability check. focus + pressSequentially
        // bypasses that race. Pick the schema textarea by excluding the
        // resource-description textarea.
        const regionField = page.locator('textarea:not(#resource-description)').last()
        await regionField.focus()
        await regionField.pressSequentially('eu-west-1')

        await page
          .getByRole('button', { name: /^(Save|Create|Add|Confirm)$/i })
          .last()
          .click()

        // Row appears in the table.
        const row = page.locator('tr', { hasText: resourcePath }).first()
        await expect(row).toBeVisible({ timeout: 20_000 })
      })

      // ===== Step 2: /variables -> create a plaintext variable via UI =====
      await test.step('step 2: create a variable via /variables UI', async () => {
        await page.goto(`${FRONTEND_URL}/variables`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: /^New variable$/ }).first().click()

        // Suffix-only path input — placeholder 'variable'.
        await page.getByPlaceholder('variable').first().fill(variableSuffix)

        // Secret toggle defaults ON in the drawer (per the screenshot). The
        // journey wants a plaintext variable — toggle it off if it's enabled.
        const secretSwitch = page.getByRole('switch', { name: /secret/i }).first()
        if (await secretSwitch.count()) {
          const checked = await secretSwitch.getAttribute('aria-checked').catch(() => null)
          if (checked === 'true') {
            await secretSwitch.click()
          }
        }

        await page.getByPlaceholder(/Update variable value/i).first().fill('prod')

        await page
          .getByRole('button', { name: /^Save$/ })
          .last()
          .click()

        const row = page
          .getByRole('row', { name: new RegExp(variablePath) })
          .first()
          .or(page.locator('tr', { hasText: variablePath }).first())
        await expect(row).toBeVisible({ timeout: 20_000 })
      })

      // ===== Step 3: deploy a Python script that reads both =====
      // API-shortcut per spec walkNote: Monaco body-replace is fragile and not
      // the substantive claim of this journey arc.
      await test.step('step 3: deploy script via API (Monaco-shortcut) and assert /scripts/get UI', async () => {
        const scriptContent =
          `import wmill\n\n` +
          `def main():\n` +
          `    cfg = wmill.get_resource('${resourcePath}')\n` +
          `    env = wmill.get_variable('${variablePath}')\n` +
          `    return {'region': cfg['region'], 'env': env}\n`
        await createScriptViaApi(request, auth, {
          path: scriptPath,
          language: 'python3',
          content: scriptContent,
          summary: 'ops journey script',
        })
        await page.goto(`${FRONTEND_URL}/scripts/get/${scriptPath}`)
        await page.waitForLoadState('domcontentloaded')
        // Script detail surfaces the path somewhere on the page (header /
        // breadcrumb / title). Walk recorded "History" + "Saved Inputs"
        // headings; anchor on the script path text instead — it's the
        // substantive claim ("the deployed script is at this path").
        await expect(page.getByText(scriptPath, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
      })

      // ===== Step 4: compose a 2-step flow via the API =====
      // API-shortcut per spec walkNote: FlowBuilder drag-drop + script picker
      // is fragile. The substantive claim is "a 2-step flow exists at the
      // deployed path and renders".
      await test.step('step 4: compose flow via API (FlowBuilder-shortcut) and assert /flows/get UI', async () => {
        const flowValue = {
          modules: [
            {
              id: 'a',
              value: {
                type: 'script' as const,
                path: scriptPath,
                input_transforms: {},
              },
            },
            {
              id: 'b',
              value: {
                type: 'rawscript' as const,
                language: 'python3',
                content: `def main(prev):\n    # ns: ${slug}\n    return prev\n`,
                input_transforms: {
                  prev: { type: 'javascript', expr: 'results.a' },
                },
              },
            },
          ],
        }
        await createFlowViaApi(request, auth, {
          path: flowPath,
          summary: 'ops journey flow',
          value: flowValue,
        })
        await page.goto(`${FRONTEND_URL}/flows/get/${flowPath}`)
        await page.waitForLoadState('domcontentloaded')
        // Substantive claim: FlowGraphViewer shows both step ids.
        // Walk-confirmed: the 'a' and 'b' labels render as exact text nodes.
        await expect(page.getByText(flowPath, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(/^a$/, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(/^b$/, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
      })

      // ===== Step 5: /routes — assert list page + New route CTA =====
      await test.step('step 5: navigate to /routes and assert page header + New route CTA', async () => {
        await page.goto(`${FRONTEND_URL}/routes`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: /^Custom HTTP routes$/ })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('button', { name: /^\+\s*New route$|^New route$/ }).first()).toBeVisible({ timeout: 10_000 })
      })

      // ===== Step 6: create the HTTP route via API =====
      // API-shortcut per spec walkNote: RouteEditor drawer is fragile.
      await test.step('step 6: create HTTP route via API (drawer-shortcut) and assert /routes UI shows the row', async () => {
        await createHttpRouteViaApi(request, auth, {
          path: routeAdminPath,
          route_path: routePathSeg,
          http_method: 'post',
          flow_path: flowPath,
          is_flow: true,
          request_type: 'sync',
          authentication_method: 'none',
          workspaced_route: true,
          enabled: true,
        })
        await page.goto(`${FRONTEND_URL}/routes`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByText(routePathSeg, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
      })

      // ===== Step 7: fire the route via API =====
      // API-shortcut per spec walkNote: there is no /routes UI affordance to
      // fire a route — the substantive claim ("route resolved to the flow")
      // is asserted in steps 8 + 9 via the runs list + job detail page.
      // HTTP_ROUTERS_CACHE refreshes every 60s; retry on 404 with backoff.
      await test.step('step 7: POST /api/r/admins/<routePath> and capture jobId', async () => {
        const { status, body } = await fireRouteWithRetry(request, auth.cookie, routePathSeg)
        expect(status, `fire-route status (body: ${body.slice(0, 200)})`).toBeGreaterThanOrEqual(200)
        expect(status).toBeLessThan(300)
        // Sync invocation surfaces the resource + variable values in-band —
        // this is the substantive end-to-end claim.
        expect(body).toMatch(/eu-west-1/)
        expect(body).toMatch(/\bprod\b/)

        // Sync route returns the *result*, not the jobId. Resolve the jobId
        // by listing recent jobs for this flow path.
        await new Promise((r) => setTimeout(r, 1_500))
        const list = await request.get(
          `${API_BASE}/w/${WID}/jobs/list?script_path_exact=${encodeURIComponent(flowPath)}&job_kinds=flow&per_page=5`,
          { headers: { Cookie: auth.cookie } },
        )
        expect(list.ok(), `jobs/list status ${list.status()}`).toBeTruthy()
        const jobs = (await list.json()) as Array<{ id: string }>
        expect(jobs.length, 'at least one job for this flow path').toBeGreaterThan(0)
        jobId = jobs[0].id
        expect(jobId, 'jobId resolved from jobs/list').not.toBe('')
      })

      // ===== Step 8: /runs — verify a row references the flow path =====
      await test.step('step 8: navigate to /runs and verify a row for the flow path', async () => {
        await page.goto(`${FRONTEND_URL}/runs`)
        await page.waitForLoadState('domcontentloaded')
        await expect(page.getByRole('heading', { name: /^Runs$/ })).toBeVisible({ timeout: 30_000 })
        // The Runs table renders the flow path (anchored by an internal link
        // to the flow detail). Walk-confirmed.
        await expect(page.getByText(flowPath, { exact: false }).first()).toBeVisible({ timeout: 60_000 })
      })

      // ===== Step 9: /run/<jobId> — verify result panel surfaces values =====
      await test.step('step 9: navigate to /run/<jobId> and verify result surfaces resource+variable', async () => {
        await page.goto(`${FRONTEND_URL}/run/${jobId}?workspace=${WID}`)
        await page.waitForLoadState('domcontentloaded')
        // Substantive claim: the resulting page surfaces the resource value
        // ('eu-west-1') and the variable value ('prod'). Anchor on these
        // strings directly — they're the proof that resource + variable
        // flowed through the script through the flow through the route.
        await expect(page.getByText(/eu-west-1/).first()).toBeVisible({ timeout: 60_000 })
        await expect(page.getByText(/\bprod\b/).first()).toBeVisible({ timeout: 60_000 })
      })
    } finally {
      // Cleanup in reverse creation order so foreign keys unwind cleanly.
      await tryDeleteHttpRouteViaApi(request, auth, routeAdminPath).catch(() => {})
      await tryDeleteFlowViaApi(request, auth, flowPath).catch(() => {})
      await tryDeleteScriptViaApi(request, auth, scriptPath).catch(() => {})
      await deleteVariable(request, auth, variablePath).catch(() => {})
      await deleteResource(request, auth, resourcePath).catch(() => {})
      await deleteResourceType(request, auth, resourceTypeName).catch(() => {})
    }
  })
})
