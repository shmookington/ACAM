# ACAM — Future Feature: AI Call Scripts

## Trigger
When an email gets **approved** in the Email Queue, a call script should automatically be generated for that specific business.

## What the Script Should Include
- Personalized talking points based on the business (name, category, website status, reviews, location)
- Opening hook that references the email that was sent
- Value proposition tailored to the business's specific needs
- Objection handling responses
- Closing / next steps

## Two Modes
1. **Human Caller** — Script displayed as a guide for a real person to use on the phone
2. **AI Voice Agent** — Script formatted as a prompt that could be fed to an AI voice calling system (future phase)

## Script Generation Approach
**Decision needed:** Two options:
- **Option A:** Save a library of proven prompt templates (cold call frameworks, objection scripts) and use those as guidelines for Gemini to customize per business
- **Option B:** Let Gemini generate a completely fresh script every time based on the business data

**Recommended:** Hybrid — Use 2-3 base prompt templates as structural guides (e.g., "opener", "pitch", "objection handling", "close") but let Gemini fill them with 100% custom content per business. This gives consistency in structure but freshness in content.

## Implementation Notes
- Trigger: After email status changes to "approved" in the outreach table
- Storage: New `call_scripts` table or add `call_script` column to `outreach` table
- UI: New panel in Email Queue that shows the script alongside the approved email
- Phase: This is Phase 4+ territory — after email sending is fully wired up
