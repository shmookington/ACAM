# ACAM — Master Build Checklist

> When every box is checked, ACAM is live and working.

---

## Setup Phase — External Services & Config
> Get all accounts, keys, and services ready before touching code.

- [ ] **Google Cloud**
  - [ ] Create a Google Cloud project (name: `acam`)
  - [ ] Enable the **Places API (New)** in the project
  - [ ] Generate an API key and restrict it to Places API only
  - [ ] Note the API key for `.env.local`

- [ ] **Supabase**
  - [ ] Create a new Supabase project (name: `acam`, under existing account)
  - [ ] Note the project URL and anon key for `.env.local`
  - [ ] Enable Email auth provider in Supabase Auth settings
  - [ ] Create your login user (your email + password)

- [ ] **Google Gemini**
  - [ ] Go to Google AI Studio → get your Gemini API key
  - [ ] Note the API key for `.env.local`

- [ ] **Resend (Email)**
  - [ ] Log into Resend (existing account from Caelborne)
  - [ ] Add and verify a custom sending domain (e.g., `caelborne.io`)
  - [ ] Create a new API key scoped to ACAM
  - [ ] Note: outreach will send from something like `outreach@caelborne.io`

- [ ] **Domain Decision**
  - [ ] Decide: standalone domain or `acam.caelborne.io`
  - [ ] If standalone: register the domain
  - [ ] If subdomain: configure DNS in your domain provider

---

## Phase 1 — Project Scaffold + Auth + Tron Design System
> The app exists, you can log in, and the Tron aesthetic is established.

- [ ] **Project Setup**
  - [x] Initialize Next.js app in `/Users/amiritate/ACAM`
  - [x] Install dependencies: `@supabase/supabase-js`, `@google/generative-ai`, `resend`
  - [x] Create `.env.local` with all keys (Supabase URL, anon key, Gemini key, Resend key, Google Places key)
  - [x] Create `.gitignore` (include `.env.local`)
  - [x] Verify `npm run dev` starts without errors

- [ ] **Supabase Auth Integration**
  - [x] Create `src/lib/supabase.js` — Supabase client with auth
  - [x] Create `src/components/AuthGate.js` — protects routes behind login
  - [x] Create `src/app/page.js` — Login page (email + password form, Tron-styled)
  - [x] Create `src/app/layout.js` — Root layout wrapping auth check
  - [ ] Verify: visiting the app shows login screen
  - [ ] Verify: logging in with your credentials works
  - [ ] Verify: unauthenticated users cannot access any page beyond login

- [x] **Tron Design System**
  - [x] Create `src/styles/globals.css`:
    - [x] CSS variables: `--neon-cyan`, `--neon-magenta`, `--neon-amber`, `--bg-void`, `--bg-card`, `--text-glow`, `--text-dim`
    - [x] Import Google Fonts: Orbitron (headers) + Share Tech Mono (body/data)
    - [x] Global reset + dark body background
    - [x] Neon grid background (CSS `linear-gradient` pattern, fixed, animated pulse)
    - [x] Scanline overlay (pseudo-element, low opacity)
    - [x] Scrollbar styling (thin, cyan)
  - [x] Create `src/styles/animations.css`:
    - [x] `@keyframes gridPulse` — subtle glow wave through grid lines
    - [x] `@keyframes glowBreath` — breathing glow on elements
    - [x] `@keyframes counterTick` — number tick-up effect
    - [x] `@keyframes bootIn` — element entrance (opacity + slight translate)
    - [x] `@keyframes scanline` — horizontal scan line sweep
    - [x] `@keyframes hoverGlow` — glow intensify on hover

- [x] **Tron Component Library**
  - [x] Create `src/components/tron/TronGrid.js` — full-page neon grid background component
  - [x] Create `src/components/tron/TronCard.js` — dark glass card with cyan border glow
  - [x] Create `src/components/tron/TronButton.js` — neon outline button with hover pulse
  - [x] Create `src/components/tron/TronCounter.js` — animated number display (ticks up)
  - [x] Create `src/components/tron/TronTerminal.js` — scrolling activity feed (terminal log style)
  - [x] Create `src/components/tron/TronMetric.js` — single stat display (label + value + glow)
  - [x] Create `src/components/tron/TronFunnel.js` — pipeline funnel visualization

- [/] **Phase 1 Verification**
  - [x] `npm run build` passes with zero errors
  - [x] Login screen renders with full Tron aesthetic (grid, glow, fonts)
  - [ ] Auth flow works end-to-end (login → dashboard → logout) — needs Supabase keys
  - [x] All Tron components render correctly with proper glow/animations
  - [x] Screenshot the login screen for proof

---

## Phase 2 — Database + Google Maps Scraper + Leads Page
> You can press a button and find real businesses without websites.

- [ ] **Supabase Schema**
  - [ ] Create `leads` table (all columns from data model in spec)
  - [ ] Create `outreach` table (all columns from data model in spec)
  - [ ] Create `pipeline_events` table (all columns from data model in spec)
  - [ ] Create `portfolio` table (all columns from data model in spec)
  - [ ] Create `settings` table (key-value store for user preferences)
  - [ ] Set up Row Level Security (RLS) policies — only authenticated user can access
  - [ ] Verify tables exist in Supabase dashboard

- [ ] **Google Maps Scraper**
  - [ ] Create `src/lib/google-maps.js`:
    - [ ] Function: `searchBusinesses(location, category)` — queries Places API
    - [ ] Function: `checkWebsite(placeId)` — gets place details, checks website field
    - [ ] Handle pagination (Google returns max 20 results per page, up to 60 total)
    - [ ] Handle rate limiting and errors gracefully
  - [ ] Create `src/lib/scoring.js`:
    - [ ] Function: `scoreLead(business)` — computes 0-100 score
    - [ ] Factors: review count, rating, has phone/email, category weight
  - [ ] Create `src/app/api/scrape/route.js`:
    - [ ] POST endpoint: accepts `{ location, category }`
    - [ ] Calls Google Maps search → scores each result → saves to Supabase
    - [ ] Deduplicates against existing leads (by name + address)
    - [ ] Returns: count of new leads found
    - [ ] Auth check: only authenticated users can call this

- [ ] **Leads Page UI**
  - [ ] Create `src/components/LeadCard.js`:
    - [ ] Displays: business name, category, rating, reviews, score badge, status
    - [ ] Quick actions: "Generate Email", "Skip", "View on Maps"
    - [ ] Tron-styled: dark glass card, cyan border, glow on hover
  - [ ] Create `src/app/leads/page.js`:
    - [ ] Scrape control panel at top: location input, category dropdown, "SCAN" button
    - [ ] Results list below: all leads from database, sorted by score
    - [ ] Filter by status: new, contacted, responded, etc.
    - [ ] Search by business name
    - [ ] Real-time count: "X leads found"
    - [ ] Loading state: scanning animation while scraper runs

- [ ] **Phase 2 Verification**
  - [ ] `npm run build` passes
  - [ ] Scrape "Miami, FL" + "Restaurants" → real businesses appear
  - [ ] Leads without websites are correctly identified
  - [ ] Lead scores are computed and displayed
  - [ ] Duplicate leads are not re-added on second scrape
  - [ ] Leads page renders with full Tron aesthetic
  - [ ] Screenshot the leads page with real data

---

## Phase 3 — AI Email Generation + Outreach Page + Sending
> ACAM writes personalized emails and sends them for you.

- [ ] **Gemini Integration**
  - [ ] Create `src/lib/gemini.js`:
    - [ ] Function: `generateOutreachEmail(leadData)` — sends business info to Gemini
    - [ ] System prompt: Caelborne's brand voice, professional but conversational
    - [ ] Includes business-specific details (name, category, rating, reviews)
    - [ ] Returns: `{ subject, body }` — ready-to-send email
    - [ ] Handle API errors, rate limits, retries

- [ ] **Email Sending**
  - [ ] Create `src/lib/resend.js`:
    - [ ] Function: `sendEmail(to, subject, body)` — sends via Resend
    - [ ] Sends from professional masked domain (e.g., `outreach@caelborne.io`)
    - [ ] Returns: send status and message ID

- [ ] **Outreach API Routes**
  - [ ] Create `src/app/api/outreach/generate/route.js`:
    - [ ] POST: accepts `{ leadId }` → pulls lead data → calls Gemini → saves draft to `outreach` table
    - [ ] Auth check
  - [ ] Create `src/app/api/outreach/send/route.js`:
    - [ ] POST: accepts `{ outreachId }` → pulls draft → sends via Resend → updates status to 'sent'
    - [ ] Auth check

- [ ] **Outreach Page UI**
  - [ ] Create `src/components/EmailPreview.js`:
    - [ ] Shows generated email in a terminal-styled preview window
    - [ ] Subject line + body, formatted nicely
    - [ ] Action buttons: "Approve & Send", "Edit", "Skip", "Regenerate"
    - [ ] Edit mode: inline editing of subject and body
  - [ ] Create `src/app/outreach/page.js`:
    - [ ] **Draft queue**: leads with pending email drafts
    - [ ] **Generate button**: select leads → batch generate emails
    - [ ] **Sent history**: list of sent emails with status (sent, opened, replied)
    - [ ] **Stats bar**: emails sent today, this week, response rate
    - [ ] Full Tron styling throughout

- [ ] **Phase 3 Verification**
  - [ ] `npm run build` passes
  - [ ] Generate email for a real lead → preview looks professional and personalized
  - [ ] Email mentions the specific business name and relevant details
  - [ ] Send a test email to yourself → it arrives from the masked domain
  - [ ] Email appears in sent history with correct status
  - [ ] Screenshot the outreach page with a generated email

---

## Phase 4 — Dashboard + Pipeline Tracking
> Your Tron command center is alive with real data.

- [ ] **Pipeline API**
  - [ ] Create `src/app/api/pipeline/route.js`:
    - [ ] GET: returns pipeline stage counts (how many leads at each stage)
    - [ ] PUT: moves a lead to a new stage, logs to `pipeline_events`
    - [ ] Auth check
  - [ ] Create `src/app/api/leads/route.js`:
    - [ ] GET: returns leads with filters (status, category, date range)
    - [ ] PUT: update lead status, notes
    - [ ] Auth check

- [ ] **Dashboard Page**
  - [ ] Create `src/app/dashboard/page.js`:
    - [ ] **Header bar**: ACAM logo (glowing), digital clock, "ALL SYSTEMS ONLINE" status
    - [ ] **Metrics strip**: 6 TronCounter components showing:
      - Total leads (all time)
      - Leads this week
      - Emails sent this week
      - Response rate %
      - Meetings booked
      - Clients closed
    - [ ] **Pipeline funnel**: TronFunnel showing leads at each stage
    - [ ] **Activity feed**: TronTerminal with recent events
    - [ ] **Quick action buttons**: "Run Scraper", "Generate Emails", "View Pipeline"
    - [ ] All data fetched live from Supabase
    - [ ] Counters animate/tick up on page load

- [ ] **Pipeline Page**
  - [ ] Create `src/components/PipelineBoard.js`:
    - [ ] Kanban-style board OR vertical funnel view
    - [ ] Columns: New → Contacted → Responded → Meeting → Proposal → Closed Won / Lost
    - [ ] Drag-and-drop to move leads between stages (or click to update)
    - [ ] Each lead card shows: name, score, last action, days in stage
  - [ ] Create `src/app/pipeline/page.js`:
    - [ ] Full pipeline board
    - [ ] Filter by category, date range
    - [ ] Summary stats at top

- [ ] **Navigation**
  - [ ] Create a sidebar or top nav with links to: Dashboard, Leads, Outreach, Pipeline, Portfolio, Settings
  - [ ] Active page highlighted with neon glow
  - [ ] Nav styled in Tron aesthetic (dark, glowing borders)

- [ ] **Phase 4 Verification**
  - [ ] `npm run build` passes
  - [ ] Dashboard shows real metrics from database
  - [ ] Counters animate on page load
  - [ ] Pipeline funnel reflects actual lead counts
  - [ ] Activity feed shows recent scrapes and emails
  - [ ] Moving a lead between pipeline stages works
  - [ ] Navigation between all pages works smoothly
  - [ ] Screenshot the full dashboard

---

## Phase 4.5 — AI Call Scripts (Post-Email Follow-Up)
> After an email is approved, ACAM generates a personalized call script for that business.

- [ ] **Script Generation**
  - [ ] Create `src/lib/scripts.js`:
    - [ ] Function: `generateCallScript(leadData, emailData)` — sends business + email context to Gemini
    - [ ] Base prompt templates for structure (opener, pitch, objections, close)
    - [ ] 100% custom content per business (name, category, needs, website status)
    - [ ] Returns: structured script with sections
  - [ ] Create `src/app/api/scripts/route.js`:
    - [ ] Auto-trigger when email status changes to "approved"
    - [ ] Saves script to DB (new `call_scripts` table or `outreach.call_script` column)

- [ ] **Two Modes**
  - [ ] **Human Caller Mode**: Script displayed as a readable guide with talking points
  - [ ] **AI Voice Mode**: Script formatted as a prompt for AI voice calling systems (future integration)
  - [ ] Toggle between modes in the UI

- [ ] **Script UI**
  - [ ] Add script panel to Email Queue — shows alongside approved emails
  - [ ] Editable: user can tweak the script before a call
  - [ ] Sections: Opening hook → Value prop → Objection handling → Close/CTA
  - [ ] Reference to the email that was sent (so the caller knows context)

- [ ] **Phase 4.5 Verification**
  - [ ] Approve an email → call script auto-generates
  - [ ] Script references the specific business and the email content
  - [ ] Both human and AI voice modes render correctly
  - [ ] Script is editable inline

---

## Phase 5 — Follow-up Automation + Weekly Digest + Intelligence
> ACAM works while you sleep.

- [ ] **Automated Follow-ups**
  - [ ] Create `src/app/api/cron/followup/route.js`:
    - [ ] Runs daily (Vercel Cron or GitHub Action trigger)
    - [ ] Finds all leads with status 'sent' where:
      - Initial email sent 3+ days ago → no reply → generate & send follow-up 1
      - Follow-up 1 sent 4+ days ago → no reply → generate & send follow-up 2
    - [ ] Uses Gemini to generate contextual follow-ups
    - [ ] Sends via Resend, logs to outreach table
    - [ ] Respects daily send limits
  - [ ] Configure Vercel Cron in `vercel.json`:
    - [ ] Follow-up check: runs daily at 9am
  - [ ] Verify: follow-ups are generated and sent automatically

- [ ] **Weekly Digest**
  - [ ] Create `src/app/api/cron/digest/route.js`:
    - [ ] Runs weekly (every Monday at 8am)
    - [ ] Compiles stats: leads found, emails sent, responses, meetings, conversions
    - [ ] Identifies top-performing industry and email style
    - [ ] Sends digest email to your personal email via Resend
  - [ ] Configure Vercel Cron for weekly trigger

- [ ] **Intelligence Layer**
  - [ ] Add industry tracking to scraper: log which categories yield best response rates
  - [ ] Add email style tracking: tag emails (short/long, question/statement opener)
  - [ ] Create a simple recommendation engine in the dashboard:
    - [ ] "Your best performing industry is [X] — focus scraping there"
    - [ ] "Short emails get 2x more replies — we've adjusted the AI prompt"
  - [ ] Feed winning patterns back into Gemini prompts automatically

- [ ] **Phase 5 Verification**
  - [ ] `npm run build` passes
  - [ ] Cron endpoint triggers correctly (test manually first)
  - [ ] Follow-up emails are contextual (reference the original email)
  - [ ] Weekly digest email arrives with accurate stats
  - [ ] Intelligence recommendations appear on dashboard
  - [ ] No emails sent to leads who have already replied

---

## Phase 6 — Portfolio Showcase Generator
> Your past work becomes your best salesman.

- [ ] **Portfolio Backend**
  - [ ] Create `src/app/api/portfolio/route.js`:
    - [ ] POST: create a new showcase (client name, industry, description, URLs)
    - [ ] GET: list all showcases
    - [ ] PUT: update a showcase
    - [ ] DELETE: remove a showcase
    - [ ] Auth check on all routes

- [ ] **AI Case Study Generator**
  - [ ] Add to `src/lib/gemini.js`:
    - [ ] Function: `generateCaseStudy(projectData)` — creates a compelling mini case study
    - [ ] Input: client name, industry, what was built, results
    - [ ] Output: formatted case study text

- [ ] **Portfolio Page UI**
  - [ ] Create `src/app/portfolio/page.js`:
    - [ ] Form to add a new project (client name, industry, before URL, after URL, results)
    - [ ] "Generate Case Study" button → AI writes the description
    - [ ] List of all showcases with preview cards
    - [ ] Each showcase has a shareable public link
    - [ ] Tron-styled throughout

- [ ] **Integration with Outreach**
  - [ ] When generating an email for a lead, auto-attach relevant portfolio link
  - [ ] Match by industry: if lead is a restaurant, attach restaurant showcase
  - [ ] Include in email body: "Here's a site we built for a similar business: [link]"

- [ ] **Phase 6 Verification**
  - [ ] `npm run build` passes
  - [ ] Create a showcase → AI generates a compelling case study
  - [ ] Shareable link works (publicly accessible, no auth required)
  - [ ] Outreach emails auto-include relevant portfolio links
  - [ ] Screenshot the portfolio page

---

## Phase 7 — Final Polish + Animations + Tron Aesthetic Pass
> Every pixel is perfect. It feels like you're inside the Tron universe.

- [ ] **Animation Polish**
  - [ ] Login screen: boot sequence animation (elements appear one by one like a computer starting up)
  - [ ] Page transitions: light-cycle horizontal wipe effect
  - [ ] Dashboard: counters tick up smoothly on load
  - [ ] Pipeline funnel: bars animate in from left with staggered delay
  - [ ] Activity feed: new entries slide in from bottom with glow flash
  - [ ] Buttons: neon glow intensifies on hover, subtle pulse on click
  - [ ] Cards: border glow brightens on hover, slight lift/scale

- [ ] **Visual Polish**
  - [ ] Grid background: ensure smooth animation, no performance jank
  - [ ] Scanline overlay: subtle but visible, not distracting
  - [ ] Glow effects: multi-layer `box-shadow` for realistic bloom
  - [ ] Color consistency: every element uses CSS variables, no hardcoded colors
  - [ ] Typography: all headers in Orbitron, all data/body in Share Tech Mono
  - [ ] Responsive: works on desktop and tablet (mobile is lower priority)

- [ ] **Sound Design (Optional / Future)**
  - [ ] Subtle synth blip on button click
  - [ ] Soft chime on successful action (email sent, scrape complete)
  - [ ] Low hum ambient background (toggleable)

- [ ] **Final Cleanup**
  - [ ] Remove any console.logs or debug code
  - [ ] Verify all API keys are in `.env.local` and not hardcoded
  - [ ] Run `npm run build` — zero errors, zero warnings
  - [ ] Test full flow end-to-end: login → scrape → generate email → send → track → dashboard updates
  - [ ] Performance check: page loads under 2 seconds
  - [ ] Deploy to Vercel (production build)
  - [ ] Verify live URL works with auth

- [ ] **Phase 7 Verification**
  - [ ] Every animation is smooth (60fps, no jank)
  - [ ] Every page matches the Tron aesthetic vision
  - [ ] Full end-to-end flow works in production
  - [ ] Screenshots of every page for proof
  - [ ] ACAM is live and working 🚀

---

## ✅ ACAM Complete
> All phases done = the machine is running. Press the button. Get leads. Close deals.
