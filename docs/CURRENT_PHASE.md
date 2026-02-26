# ACAM — Current Status

> **Last Updated**: February 24, 2026
> **Current Phase**: PRE-BUILD (Planning & Setup)
> **Next Action**: Complete the setup checklist, then begin Phase 1

---

## What Is ACAM?

Automated Customer Acquisition Machine — a $0-budget tool that scrapes Google Maps for businesses without websites, generates AI-powered personalized cold outreach via Google Gemini, and tracks the entire sales pipeline. All wrapped in an 80s Tron command center UI.

**Built for**: [Caelborne.io](https://caelborne.io) (custom website building business)

---

## Quick Reference

| Item | Detail |
|---|---|
| **Workspace** | `/Users/amiritate/ACAM` |
| **Full Spec** | `docs/IMPLEMENTATION_PLAN.md` |
| **Tech Stack** | Next.js + Vanilla CSS + Supabase + Gemini API + Resend + Google Places API |
| **UI Aesthetic** | 80s Tron — neon cyan grid, dark void background, glowing terminals, smooth modern performance |
| **Auth** | Supabase Auth (login-protected) |
| **AI** | Google Gemini API (user already pays for top-tier plan) |
| **Email** | Resend with custom domain masking (sends as professional alias, not Gmail) |
| **Hosting** | Vercel (standalone site — its own product) |
| **Cost** | ~$0-10/month |

---

## Build Phases

| Phase | What | Status |
|---|---|---|
| **Setup** | Google Cloud project, Supabase project, Gemini key, Resend domain, domain decision | ⏳ NOT STARTED |
| **Phase 1** | Project scaffold + Supabase Auth + Tron design system + login screen | ⏳ NOT STARTED |
| **Phase 2** | Database schema + Google Maps scraper + leads page | ⏳ NOT STARTED |
| **Phase 3** | Gemini email generation + outreach page + Resend sending | ⏳ NOT STARTED |
| **Phase 4** | Dashboard with live metrics + pipeline tracking | ⏳ NOT STARTED |
| **Phase 5** | Follow-up automation + weekly digest + smart recommendations | ⏳ NOT STARTED |
| **Phase 6** | Portfolio showcase generator | ⏳ NOT STARTED |
| **Phase 7** | Polish, animations, sound design, final Tron pass | ⏳ NOT STARTED |

---

## Setup Checklist (Do These Before Phase 1)

- [ ] Set up Google Cloud project + enable Places API + get API key
- [ ] Create new Supabase project (under existing account)
- [ ] Get Gemini API key from Google AI Studio
- [ ] Verify a custom domain in Resend for professional email masking
- [ ] Decide on domain: standalone or subdomain (`acam.caelborne.io`)

---

## 5 Core Features (Summary)

1. **Google Maps Lead Scraper** — press a button, find businesses without websites
2. **Tron Command Center** — dashboard with glowing metrics, pipeline funnel, activity feed
3. **AI Cold Outreach** — Gemini writes personalized emails, auto follow-ups
4. **Portfolio Showcase** — auto-generate case studies from completed work
5. **Smart Pipeline** — tracks leads, learns which industries/emails work best

---

## Future Expansion (Parked)

- Meta Ads integration (paid acquisition engine)
- Will be added when organic engine is proven and budget increases
