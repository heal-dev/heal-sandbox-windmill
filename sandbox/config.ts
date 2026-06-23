export const FRONTEND_URL = process.env.WINDMILL_FRONTEND_URL ?? 'http://localhost'
export const BACKEND_URL = process.env.WINDMILL_BACKEND_URL ?? 'http://localhost'
export const API_BASE = `${BACKEND_URL}/api`

export const SEED = {
  admin: {
    email: 'admin@windmill.dev',
    password: 'changeme',
  },
  workspace: {
    id: 'admins',
    name: 'Admins',
  },
} as const

export const AUTH_STATE_PATH = 'e2e/.auth/admin.json'
