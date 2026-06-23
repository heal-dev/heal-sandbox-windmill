import { FRONTEND_URL, BACKEND_URL } from '../config'

export type AppRecord = {
  name: string
  cwd: string
  command: string
  url: string
  port: number
  timeout: number
}

export const apps: AppRecord[] = [
  {
    name: 'windmill-server',
    cwd: '../windmill',
    command: 'docker compose up -d windmill_server windmill_worker db',
    url: `${BACKEND_URL}/api/version`,
    port: 80,
    timeout: 180_000,
  },
  {
    name: 'windmill-frontend',
    cwd: '../windmill',
    command: 'docker compose up -d caddy',
    url: FRONTEND_URL,
    port: 80,
    timeout: 60_000,
  },
]
