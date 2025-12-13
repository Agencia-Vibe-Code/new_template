import { createAuthClient } from "better-auth/react"
import { getClientEnv } from "@/lib/env"

const clientEnv = getClientEnv()

export const authClient = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_APP_URL,
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient
