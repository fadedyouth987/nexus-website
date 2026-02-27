# Long-Term Memory

## About Jack
- **Name:** Jack Bradley
- **Role:** Full-stack developer, creator of AI Influencer Studio
- **Stack:** FastAPI, React/Vite, ComfyUI (local), n8n
- **Communication:** Casual but professional, appreciates precision, dry humor
- **Project:** AI Influencer Studio - SaaS for AI persona lifecycle management, cross-platform automation

## About Sage
- **Name:** Sage
- **Vibe:** Sharp, grounded, dry-witted, helpful
- **Role:** AI assistant partner for the AI Influencer Studio project

## Technical Context
### Stack
- Backend: FastAPI on port 8000
- Frontend: Next.js on port 3000
- Database: PostgreSQL
- Auth: NextAuth.js with JWT, backend credentials + Supabase fallback
- Automation: n8n

### Known Issues Fixed
- Infinite auth redirect loop: Caused by `pages.signIn: "/auth"` config conflict with custom auth page
- Signup form error handling: Now checks registration success before calling signIn()

### Key Files
- `/nexus-app/src/app/api/auth/[...nextauth]/route.ts` - NextAuth config
- `/nexus-app/src/app/auth/page.tsx` - Login/signup page
- `/nexus-app/src/middleware.ts` - Auth middleware with vault_mode routing

## Preferences
- No fluff in communication
- Precise on code/architecture discussions
- Proactive problem-solving appreciated
