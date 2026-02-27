import NextAuth from "next-auth"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

declare module "next-auth" {
  interface User {
    id: string
    vault_mode?: string
    accessToken?: string
  }
  interface Session {
    user: {
      id: string
      vault_mode?: string
      accessToken?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
    vault_mode?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    vault_mode?: string
    accessToken?: string
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.detail || "Invalid credentials")
          }

          const data = await response.json()
          const { access_token, user_id } = data

          return {
            id: user_id,
            email: credentials.email,
            name: credentials.email.split("@")[0],
            image: null,
            accessToken: access_token,
          }
        } catch (error) {
          console.error("Auth error:", error)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accessToken = (user as any).accessToken
        token.vault_mode = "sfw"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.accessToken = token.accessToken as string
        session.user.vault_mode = token.vault_mode as string
        ;(session as any).vault_mode = token.vault_mode as string
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || "your-secret-key-change-this",
  },
  pages: {
    signIn: "/auth",
  },
}

export const { handlers, auth, signIn: nextAuthSignIn, signOut: nextAuthSignOut } = NextAuth(authOptions)
