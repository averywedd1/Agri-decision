# AgriDecision Test Website

This folder is now set up as a deployable website with:
- `index.html` (farmer-facing site)
- `api/chat.js` (server endpoint used by the AI chat box)

## Fastest way to put it online (Vercel)

1. Create a new GitHub repo.
2. Upload the contents of this folder.
3. In Vercel, click **Add New Project** and import that GitHub repo.
4. Deploy.

After deploy, your public URL will look like:
- `https://your-project-name.vercel.app`

## Optional environment variables (if you do not want to paste keys in the UI)

Add any of these in Vercel Project Settings -> Environment Variables:
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `MISTRAL_API_KEY`
- `CUSTOM_API_KEY`

If these are not set, the site will use the key typed in the page.

## Test checklist

1. Open your live URL.
2. Fill in a few farm inputs.
3. Go to **Ask AI**.
4. Pick provider + enter API key (if not using env vars).
5. Send a question and confirm the response appears.

