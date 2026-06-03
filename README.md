# AgriDecision AI

Single-page farm business analytics site deployed on Vercel.

## What changed

- The homepage uses the cleaner AgriDecision AI business-analysis design.
- Browser API-key entry was removed.
- AI calls go through `api/chat.js` and use Vercel environment variables.
- The AI dropdown can show configured providers and use "All configured AIs" when multiple env keys are present.
- The page includes real sign-up/sign-in support when Supabase is configured.
- Accounts can save multiple farm-analysis projects to the cloud database and reload them across devices.
- Market Watch loads delayed commodity futures snapshots from CME Group when available.
- AI responses are cleaned so markdown `**bold**` markers do not show as raw asterisks.

## Vercel environment variables

Set the provider key you want to use:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`
- `CUSTOM_API_KEY`

Optional model overrides:

- `GEMINI_MODEL`
- `OPENAI_MODEL`
- `OPENROUTER_MODEL`
- `GROQ_MODEL`
- `MISTRAL_MODEL`
- `CUSTOM_MODEL`
- `CUSTOM_ENDPOINT`

When more than one provider key is set, users can choose `All configured AIs`. That sends the same prompt to each configured provider and combines the responses. This can be slower and can increase provider usage costs.

## Cross-device accounts

Use Supabase for cloud sign-in and database-backed project storage.

Add these Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then open the Supabase SQL editor and run `supabase-schema.sql`. The schema creates:

- `agridecision_profiles` for account profile data.
- `agridecision_projects` for saved farm projects, reports, and chat history.
- Row-level security policies so users can only access their own records.

If Supabase is not configured yet, the site still saves projects locally in the browser as a fallback.

## Notes

CME market data is delayed and should be verified directly with CME Group before trading, hedging, or contract decisions.
