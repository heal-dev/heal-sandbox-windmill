import { test, expect } from '../../data/fixtures'
import { FRONTEND_URL, API_BASE, SEED } from '../../../config'
import { loginAdmin } from '../../helpers/workspaceApi'
import { createFlowViaApi, tryDeleteFlowViaApi } from '../../helpers/flowsApi'

// AI03 — Persistence and detail-page rendering of an AI Agent flow step.
// The aiagent FlowModuleValue is declared in
// windmill/backend/windmill-types/src/flows.rs L966-973 — required fields are
// `input_transforms` (HashMap) and `tools` (Vec<AgentTool>); tools=[] is
// accepted (covered by the ai_agent_omit_output_from_conversation_defaults_to_false
// test at L1231-1245). The frontend factory createAiAgent() in
// flowStateUtils.svelte.ts L177-197 seeds input_transforms with provider /
// output_type / user_message — we mirror that shape so the persisted flow is
// renderable by the FlowEditor. The /flows/get detail page renders the
// literal text "AI Agent" via FlowGraphViewerStep.svelte L144-145 when the
// step's value.type is 'aiagent'.
//
// Running the agent end-to-end is NOT covered here: that would require a real
// LLM provider key wired into workspace_settings.ai_config — out of scope on a
// credential-less CE sandbox. The persistence + render path is fully testable.

const wid = SEED.workspace.id

test.describe('@flow @feature:ai-agents @worker AI03 — Persist AI Agent flow step', () => {
  test('Flow with a single aiagent module is persisted and detail page shows "AI Agent"', async ({
    page,
    request,
    fx,
  }) => {
    const slug = `ai03-${fx.ns}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30)
    const flowPath = `u/admin/${slug}`
    const auth = await loginAdmin(request)

    try {
      // Pre-delete any leftover row at this path (defensive — see tryDelete in
      // flowsApi.ts L96-102).
      await tryDeleteFlowViaApi(request, auth, flowPath)

      // Build the flow value with one aiagent module. Mirrors the frontend
      // createAiAgent() default shape (flowStateUtils.svelte.ts L181-192). The
      // provider resource is left blank because we never invoke the agent —
      // the backend persists the module value as-is.
      await createFlowViaApi(request, auth, {
        path: flowPath,
        summary: `AI03 ${slug}`,
        value: {
          modules: [
            {
              id: 'a',
              value: {
                type: 'aiagent',
                tools: [],
                input_transforms: {
                  provider: {
                    type: 'static',
                    value: { kind: 'openai', resource: '', model: '' },
                  },
                  output_type: { type: 'static', value: 'text' },
                  user_message: { type: 'static', value: `ai03-${slug}` },
                },
              },
            },
          ],
        },
      })

      // GET /api/w/<wid>/flows/get/<path> — verify the persisted module type
      // is 'aiagent' and our slug-stamped user_message round-trips. This proves
      // the backend deserialized the AIAgent variant successfully.
      const getRes = await request.get(`${API_BASE}/w/${wid}/flows/get/${flowPath}`, {
        headers: { Cookie: auth.cookie },
      })
      expect(getRes.status(), 'flows/get must succeed').toBe(200)
      const body = (await getRes.json()) as {
        value: { modules: Array<{ value: { type: string; input_transforms?: any } }> }
      }
      expect(body.value.modules.length).toBeGreaterThan(0)
      expect(body.value.modules[0].value.type).toBe('aiagent')
      // user_message round-trips through serde — proves the persisted JSON is
      // exactly what we sent and the module's input_transforms survived.
      const userMessage = body.value.modules[0].value.input_transforms?.user_message?.value
      expect(userMessage).toBe(`ai03-${slug}`)

      // Now mount the deployed flow detail page and assert the
      // FlowGraphViewer renders "AI Agent" for this step
      // (FlowGraphViewerStep.svelte L144-145).
      await page.addInitScript(() => localStorage.setItem('workspace', 'admins'))
      await page.goto(`${FRONTEND_URL}/flows/get/${flowPath}`)
      await page.waitForURL(/\/flows\/get\//, { timeout: 30_000 })

      // The flow detail page's +page.js sets stuff.title = `Flow ${path}`
      // (flows/get/[...path]/+page.js) → document title becomes
      // "Flow u/admin/ai03-<slug> | Windmill". This is the most stable
      // "page mounted" signal — DetailPageHeader renders the path/summary in
      // a <span> rather than a heading element so getByRole('heading') misses.
      await expect(page).toHaveTitle(new RegExp(`Flow.*${slug}`, 'i'), {
        timeout: 30_000,
      })

      // The "AI Agent" literal is rendered by FlowGraphViewerStep.svelte
      // L144-145 when the step's value.type is 'aiagent'. Use first()
      // because the same string is also reused in other surfaces
      // (FlowCardHeader badge, FlowLogViewer label) on a hydrated flow
      // detail page.
      await expect(
        page.getByText('AI Agent', { exact: true }).first(),
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      await tryDeleteFlowViaApi(request, auth, flowPath)
    }
  })
})
