# AI Image Generator

> **Live demo:** https://aiimagegen-phi.vercel.app  
> Deployed on Vercel · Auth & DB via Supabase · Image generation with Hugging Face (FLUX.1-schnell)

[![Live](https://img.shields.io/badge/demo-online-brightgreen)](https://aiimagegen-phi.vercel.app)
[![Vercel](https://img.shields.io/badge/hosted_on-Vercel-black)](https://vercel.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E)](https://supabase.com/)
[![HuggingFace](https://img.shields.io/badge/Hugging%20Face-FLUX.1--schnell-ffcc00)](https://huggingface.co/)

Full-stack AI Image Generator built as part of the [DevChallenges.io](https://devchallenges.io/) challenge.  
Users can generate images with prompts, view them in a feed, save favorites into their collection, and explore their generation history — all with authentication and persistence.

----

## Tech Stack

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router, TypeScript, Suspense, Client/Server Components)
- **Database & Auth**: [Supabase](https://supabase.com/) with **PostgreSQL**
- **Storage**: Supabase Storage (for image uploads & persistence)
- **Backend**: API routes with Next.js (serverless functions on Vercel)
- **AI Model**: [Hugging Face](https://huggingface.co/) – FLUX.1-schnell for image generation
- **Styling**: Tailwind CSS
- **Deployment**: [Vercel](https://vercel.com/)

----

## Features

-  Authentication with **GitHub login**
-  Generate AI images from text prompts (with support for negative prompts, seeds, guidance, resolution, etc.)
-  Explore a **global feed** of generated images
-  Save/unsave images to a personal **collection**
-  View **generation history** with prompt details
-  Responsive UI — desktop & mobile layouts

----

## Setup & Development

1. **Clone the repo**
   ```bash
   git clone https://github.com/SleimaD/ai-image-gen.git
   cd ai-image-gen
   ```
2. Install dependencies
   ```bash
     npm install
   ```
3.	Environment variables
 Create a .env.local file with:
 ```env
  NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
  SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>
  HUGGINGFACE_API_KEY=hf_...
  HF_MODEL=black-forest-labs/FLUX.1-schnell
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  MOCK_GENERATION=false
 ```
4. Run the dev server
  ```bash
   npm run dev 
  ```

----

## Deployment

- Hosted on Vercel.
- Supabase project set up for authentication, database, and storage.
- Hugging Face API connected for AI image generation.


⸻

## Live

- Frontend: https://aiimagegen-phi.vercel.app
- Backend: Next.js API Routes (serverless on Vercel)
- Database & Auth: Supabase (PostgreSQL + Storage)

---

## Acknowledgements

DevChallenges.io for the project idea & template
	
