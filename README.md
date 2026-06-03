# AgriDecision AI

Single-page farm business analytics site deployed on Vercel.

## What changed

- The homepage uses the cleaner AgriDecision AI business-analysis design.
- Browser API-key entry was removed.
- AI calls go through `api/chat.js` and use Vercel environment variables.
- The AI dropdown can show configured providers and use "All configured AIs" when multiple env keys are present.
- The page includes a lightweight local account/profile option.
- Accounts can save multiple farm-analysis projects in the browser under the account email.
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

## Notes

The account and project options currently save locally in the user's browser. Real password accounts, cross-device project syncing, and team access require adding an auth/database provider such as Supabase, Firebase, Clerk, or Auth0.

CME market data is delayed and should be verified directly with CME Group before trading, hedging, or contract decisions.
