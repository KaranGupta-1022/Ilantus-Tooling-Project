# IAM Use Case Generator — Build Guide

A full-stack web app that takes a vendor's website URL or product description as input,
uses an LLM to extract and map their capabilities to a master IAM use case library, and
outputs a structured gap analysis showing what the vendor covers and what they miss.
**If the LLM identifies a vendor capability that does not exist in the master library, it
flags it as a new use case, queues it for human review, and appends it to the library upon
approval.**

## Tech Stack

`Python` `Flask` `React` `PostgreSQL` `OpenAI API` `Docker` `GitHub Actions (CI/CD)`

## Timeline Overview


| Phase | Focus                              | Days |
| ----- | ---------------------------------- | ---- |
| 0     | Learning and prerequisites         | 0    |
| 1     | Project setup                      | 0.5  |
| 2     | Database and use case library      | 1    |
| 3     | LLM integration and mapping engine | 2    |
| 4     | New use case discovery engine      | 2.5  |
| 5     | Flask backend and REST API         | 3    |
| 6     | React frontend                     | 4    |
| 7     | Connect frontend to backend        | 4.5  |
| 8     | Polish, export, and edge cases     | 5    |
| 9     | Deployment                         | 5.5  |
| 10    | CI/CD and documentation            | 6    |


---



## $0 Cost Plan

Every component of this project runs free.

**LLM API:** Sign up for OpenAI and use the free credit tier that comes with a new account.
If that is exhausted, Groq offers a completely free API with fast inference on Llama 3
models. As a backup, Google Gemini's API has a generous free tier. All three use the same
request/response pattern so switching between them is a one-line change.

**Database:** Use Neon's free Postgres tier at neon.tech. It is a serverless Postgres host
with a permanent free plan, no credit card required. It is fully Postgres-compatible so
everything you build locally works identically in production.

**Backend hosting:** Render's free web service tier hosts Flask apps at no cost. It
auto-deploys from GitHub on every push.

**Frontend hosting:** Vercel's free tier hosts React apps. It also auto-deploys from GitHub.

**Everything else:** Docker for local development, GitHub for version control and CI/CD —
both free.

---



## Phase 0: Learning and Prerequisites (Day 0)

- [ ] Read the OpenAI Python quickstart — [https://platform.openai.com/docs/quickstart](https://platform.openai.com/docs/quickstart)
- [ ] Read Flask quickstart — [https://flask.palletsprojects.com/en/3.0.x/quickstart/](https://flask.palletsprojects.com/en/3.0.x/quickstart/)
- [ ] Skim the Neon Postgres getting started guide — [https://neon.tech/docs/get-started-with-neon/signing-up](https://neon.tech/docs/get-started-with-neon/signing-up)
- [ ] Review your existing use case library from the Ilantus project — you will use this as
  ```
  the seed data for the use case database in Phase 2
  ```
- [ ] Read React useEffect and useState hooks if you have not worked with them recently —
  ```
  https://react.dev/reference/react
  ```

---



## Phase 1: Project Setup (Day 0.5)

- [x] New GitHub repo: `iam-use-case-generator`, public, MIT license, Python `.gitignore`
- [x] Clone and set up folder structure:

```
iam-use-case-generator/
  backend/
  frontend/
  .env
  .gitignore
  README.md
  docker-compose.yml
```

- [x] Create and activate a Python virtual environment inside `backend/`
- [x] `backend/requirements.txt`:

```
flask==3.0.0
flask-cors==4.0.0
psycopg2-binary==2.9.9
openai==1.12.0
python-dotenv==1.0.0
requests==2.31.0
beautifulsoup4==4.12.3
```

- [x] `.env` file (never commit this):

```
OPENAI_API_KEY=your_key_here
DATABASE_URL=your_neon_connection_string_here
```

- [x] `.gitignore` additions: `venv/`, `__pycache__/`, `*.pyc`, `.env`, `node_modules/`
- [x] Sign up for Neon at neon.tech, create a new project, copy the connection string into `.env`
- [x] Sign up for OpenAI at platform.openai.com, create an API key, copy it into `.env`

---



## Phase 2: Database and Use Case Library (Day 1)

This phase builds the master use case library that the LLM maps vendor capabilities
against, and adds the tables needed to support new use case discovery and review.

- [x] Connect to your Neon database using any Postgres client (TablePlus has a free tier,
  ```
  or use the Neon web console)
  ```
- [x] `backend/schema.sql` — create the following tables:

```sql
CREATE TABLE use_cases (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  -- 'manual' = seeded by you, 'llm_approved' = discovered by LLM and approved
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  input_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE evaluations (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  use_case_id INTEGER REFERENCES use_cases(id),
  covered BOOLEAN NOT NULL,
  confidence FLOAT,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Holds new use cases the LLM discovered that are not yet in the master library.
-- These sit here until a human reviews and approves or rejects them.
CREATE TABLE pending_use_cases (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  -- the vendor whose evaluation triggered the discovery
  suggested_code VARCHAR(10),
  -- LLM-suggested code, e.g. C13 or U10, may need human adjustment
  suggested_name VARCHAR(100) NOT NULL,
  suggested_category VARCHAR(50) NOT NULL,
  suggested_description TEXT NOT NULL,
  llm_reasoning TEXT,
  -- why the LLM thinks this is a new, distinct use case
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

- [x] `backend/seed.py` — seed the `use_cases` table with your master use case list from
  ```
  the Ilantus project. Use the codes you already established (C1 through C12, R1
  through R9, U1 through U9, D1 through D3, GEN-1 through GEN-11). Each row should
  include the code, name, category, description, and `source = 'manual'`.
  ```
- [x] Run the seed script, verify rows are inserted in the Neon console
- [x] `backend/db.py` — a simple database connection helper using `psycopg2` and the
  ```
  `DATABASE_URL` from your `.env`
  ```

---



## Phase 3: LLM Integration and Mapping Engine (Day 2)

This phase builds the engine that maps vendor capabilities to existing use cases in the
master library. Phase 4 extends it to also discover new ones.

- [ ] `backend/scraper.py` — a `scrape_vendor_page(url)` function that uses `requests` and
  ```
  `BeautifulSoup` to fetch and extract the main text content from a vendor URL, strips
  HTML tags and navigation noise, and returns clean text. Cap the output at roughly
  3000 words to stay within token limits.
  ```

- [ ] `backend/mapping_engine.py` — a `MappingEngine` class:

```python
class MappingEngine:
    def __init__(self):
        self.client = OpenAI()

    def _load_use_cases(self):
        # fetch all APPROVED use cases from the database
        # includes both 'manual' and 'llm_approved' sources
        # returns a list of dicts: {code, name, category, description}

    def map_vendor(self, vendor_text, vendor_id):
        use_cases = self._load_use_cases()
        mapping_results = self._run_mapping(vendor_text, use_cases)
        discovery_results = self._run_discovery(vendor_text, use_cases, vendor_id)
        return {
            "mapping": mapping_results,
            "new_use_cases_found": discovery_results
        }
```

- [ ] Build the **mapping prompt** carefully. This is the most important part of Phase 3.
  ```
  The prompt should:
  ```
  - Give the LLM the full list of approved use cases with codes, names, and descriptions
  - Provide the vendor text
  - Ask it to return a JSON array where each element is
  `{use_case_code, covered, confidence, reasoning}`
  - Explicitly instruct it to return only JSON with no preamble or markdown fences
  - Tell it confidence should be a float from 0.0 to 1.0
  - Tell it to only evaluate against the provided use case list — new capabilities
  will be handled separately in a second call

- [ ] Parse the LLM response with a try/except around `json.loads()`. If parsing fails,
  ```
  log the raw response and return a graceful error.
  ```

- [ ] `backend/test_mapping.py` — test the engine with two or three vendors you already
  ```
  know well from the Ilantus project. Compare the LLM's output against your own manual
  assessment. Tune the prompt if the results are off.
  ```

---



## Phase 4: New Use Case Discovery Engine (Day 2.5)

This is the standout feature of the project. After the mapping call in Phase 3 runs, a
second LLM call analyzes the vendor text for capabilities that do not map to anything in
the existing library. If it finds genuine new use cases, they are inserted into
`pending_use_cases` and surfaced to the user for review. Approved ones get appended to the
master library and are immediately available for all future evaluations.

### 4.1 — Discovery Prompt

Add a `_run_discovery()` method to `MappingEngine`. This method makes a second, separate
LLM call using a different prompt:

```
You are an IAM (Identity and Access Management) expert building a use case library.

Below is the current master list of IAM use cases. Each has a code, name, and description.

{use_case_list}

Below is a vendor's product description:

{vendor_text}

Your job is to identify vendor capabilities that represent GENUINELY NEW IAM use cases
not already covered by anything in the master list above.

Rules:
- Do not flag capabilities that are just a variation or implementation detail of an
  existing use case. For example, "browser-based deprovisioning" is still Instant Access
  Revocation (D1), not a new use case.
- Only flag something as new if it represents a meaningfully distinct IAM function that
  does not exist anywhere in the master list.
- For each new use case you find, suggest a code that follows the existing pattern
  (C, R, U, D, or GEN followed by the next available number in that category).
- Return only a JSON array. If you find no new use cases, return an empty array [].

Each element in the array should be:
{
  "suggested_code": "C13",
  "suggested_name": "Short name for the use case",
  "suggested_category": "Create / Onboard",
  "suggested_description": "One sentence describing what this use case covers.",
  "llm_reasoning": "Why this is a new use case and not a variant of an existing one."
}
```

- [ ] Parse the discovery response the same way as the mapping response — try/except around
  ```
  `json.loads()`, graceful error handling if the LLM returns malformed output
  ```
- [ ] For each item in the parsed array, insert a row into `pending_use_cases` with the
  ```
  `vendor_id`, all suggested fields, and `status = 'pending'`
  ```
- [ ] Return the list of newly discovered pending use cases as part of the overall
  ```
  `map_vendor()` response so the API and frontend can surface them immediately
  ```



### 4.2 — Code Collision Prevention

The LLM may suggest a code like `C13` that already exists if two evaluations run close
together. Add a `_get_next_code(category_prefix)` helper that queries the database for the
highest existing code in that category across both `use_cases` and `pending_use_cases` and
returns the next one. Override the LLM's suggested code with this value before inserting.

```python
def _get_next_code(self, category_prefix):
    # query both use_cases and pending_use_cases for codes starting with category_prefix
    # extract the numeric suffix, find the max, return prefix + (max + 1)
    # e.g. if C12 is the highest existing C code, return C13
```



### 4.3 — Deduplication Check

Before inserting into `pending_use_cases`, run a quick similarity check to avoid inserting
the same new use case twice from two different vendor evaluations. The simplest approach
for this project: query `pending_use_cases` for any row where `suggested_name` is within
a rough match of the new suggestion, and skip the insert if a near-duplicate already exists
in `pending` or `approved` state.

For a more robust approach that is still free: run a third short LLM call that takes the
proposed new use case and the list of existing pending use cases and asks "is this a
duplicate of anything already in this list?" This is optional but worth adding if you have
time — it is a strong talking point in an interview.

### 4.4 — Approval Flow (Backend)

Add three database helper functions in `backend/db.py`:

```python
def get_pending_use_cases():
    # return all rows from pending_use_cases where status = 'pending'

def approve_pending_use_case(pending_id):
    # fetch the pending row
    # insert it into the use_cases table with source = 'llm_approved'
    # update pending_use_cases set status = 'approved', reviewed_at = NOW()
    # return the new use_case id

def reject_pending_use_case(pending_id):
    # update pending_use_cases set status = 'rejected', reviewed_at = NOW()
```

---



## Phase 5: Flask Backend and REST API (Day 3)

- [ ] `backend/app.py` — Flask app with Flask-CORS enabled

- [ ] Endpoints:

```
GET   /api/health
      Returns {status: ok}

GET   /api/use-cases
      Returns all approved use cases from the database grouped by category.
      Includes both 'manual' and 'llm_approved' sources.

POST  /api/evaluate
      Body: {vendor_name, input_type, input_value}
      input_type is either "url" or "text"
      Scrapes or uses the text directly, runs the mapping engine and the
      discovery engine, saves all results to the database, and returns:
      {
        vendor_id,
        mapping: [...],
        new_use_cases_found: [...]
        -- new_use_cases_found lists the pending use cases discovered this run
      }

GET   /api/vendors
      Returns list of all previously evaluated vendors

GET   /api/vendors/{id}
      Returns full evaluation results for a specific vendor

GET   /api/compare?ids=1,2,3
      Returns side-by-side coverage comparison for multiple vendors

GET   /api/pending-use-cases
      Returns all pending use cases awaiting review

POST  /api/pending-use-cases/{id}/approve
      Approves a pending use case, inserts it into the master library,
      returns the new use case row

POST  /api/pending-use-cases/{id}/reject
      Rejects a pending use case, marks it as rejected
      
PATCH /api/pending-use-cases/{id}
      Allows editing the suggested code, name, category, or description
      before approving — because the LLM's suggestion may need minor
      human correction before it is added to the library
```

- [ ] Add basic input validation on the `/api/evaluate` endpoint — check that `vendor_name`
  ```
  is not empty, that a URL is a valid URL format, and that raw text is not blank
  ```
- [ ] Add error handling that returns clean JSON error responses rather than Flask's default
  ```
  HTML error pages
  ```
- [ ] Test all endpoints with curl or Postman before moving to the frontend

---



## Phase 6: React Frontend (Day 4)

- [ ] `npx create-react-app frontend` or `npm create vite@latest frontend -- --template react`
  ```
  (Vite is faster, recommended)
  ```
- [ ] `npm install axios react-router-dom`
- [ ] Set up five pages using React Router:
  - Home / input page
  - Results page
  - History page (past evaluations)
  - Compare page (side-by-side vendor comparison)
  - Use Case Library page (master library + pending review queue)

- [ ] **Input page:** a form with a vendor name field, a toggle between URL input and
  ```
  paste-text input, and a submit button. Show a loading spinner while the evaluation
  runs since two LLM calls run sequentially and may take 5 to 10 seconds total.
  ```

- [ ] **Results page:** displays the vendor name, a summary card showing how many use
  ```
  cases are covered vs. total, a category breakdown, a full table of all use cases with
  a green check or red X, the confidence score, and the LLM's reasoning per use case.
  Below the main results, show a distinct **New Use Cases Discovered** section that
  lists any capabilities the LLM found that were not in the master library. Each item
  should show the suggested code, name, description, and the LLM's reasoning for why
  it is a new use case. Include a note that these are pending human review. Add an
  Export to CSV button.
  ```

- [ ] **History page:** a table of all previously evaluated vendors with their coverage
  ```
  percentage and a link to their full results.
  ```

- [ ] **Compare page:** lets the user select two or three vendors from their history and
  ```
  renders a side-by-side table showing coverage across all use cases, with color coding
  to highlight where vendors differ.
  ```

- [ ] **Use Case Library page:** two tabs.
  - **Master Library tab:** a searchable, filterable table of all approved use cases
  showing code, name, category, description, and source (manual or llm_approved).
  This gives full visibility into how the library has grown over time.
  - **Pending Review tab:** a list of all pending use cases with their suggested code,
  name, category, description, and the LLM's reasoning. Each item has three actions:
  an Edit button (opens an inline form to adjust the code, name, or description
  before approving), an Approve button, and a Reject button. Approved items
  immediately move to the Master Library tab and are available for all future
  evaluations. Rejected items are removed from the queue.

- [ ] Styling: clean and professional. Dark sidebar, white content area, green for covered,
  ```
  red for not covered, grey for low confidence, amber/yellow for pending use cases
  awaiting review. You do not need a UI library but if you want one, shadcn/ui or
  plain Tailwind CSS are both free and work well with React.
  ```

---



## Phase 7: Connect Frontend to Backend (Day 4.5)

- [ ] Create `frontend/src/api.js` — a centralized Axios client that points to your Flask
  ```
  backend URL, with interceptors for error handling
  ```
- [ ] Wire up each page to its corresponding API endpoint
- [ ] Handle loading states, empty states, and error states on every page
- [ ] Test the full flow end to end:
  - Enter a vendor URL
  - Watch it scrape and evaluate
  - See mapping results populate
  - See any new use cases discovered appear in the New Use Cases Discovered section
  - Navigate to the Use Case Library page, find the new use case in the Pending Review tab
  - Edit the suggested description slightly, then approve it
  - Confirm it now appears in the Master Library tab
  - Run a second vendor evaluation — confirm the newly approved use case is now included
  in the mapping and the LLM evaluates the new vendor against it

---



## Phase 8: Polish, Export, and Edge Cases (Day 5)

- [ ] Implement the Export to CSV button on the results page. Export two sheets worth of
  ```
  data in one file: the standard mapping results, and a second section listing any new
  use cases discovered during that evaluation.
  ```
- [ ] Handle edge cases:
  - URL that returns a 404 or blocks scraping — return a clear error and suggest using
  paste-text mode
  - LLM mapping response that is not valid JSON — retry once, then return a graceful error
  - LLM discovery response that is not valid JSON — log it, return an empty discovery
  result, and do not block the mapping results from returning
  - Vendor text that is too short to evaluate meaningfully — flag it and warn the user
  - Duplicate vendor name submissions — allow and version them
  - LLM suggests a new use case code that already exists — your `_get_next_code()` helper
  from Phase 4.2 prevents this, but add a database-level unique constraint on
  `use_cases.code` as a safety net
  - Two evaluations run simultaneously and both try to insert the same new use case into
  `pending_use_cases` — your deduplication check from Phase 4.3 handles this
- [ ] Add a confidence threshold indicator — visually distinguish use cases the LLM marked
  ```
  as covered with high confidence from ones it was uncertain about
  ```
- [ ] Do a full end-to-end test with at least five vendors from the Ilantus project.
  ```
  Cross-check the LLM's output against your own manual research notes. Deliberately
  include at least one vendor whose capabilities you know fall outside the current
  master library (Aquera's B2B Partner IAM or StackBob's SaaS License Optimization
  are good candidates) to confirm the discovery engine catches them.
  ```

---



## Phase 9: Deployment (Day 5.5)

**Backend on Render:**

- [ ] Push your code to GitHub
- [ ] Go to render.com, create a free account, connect your GitHub repo
- [ ] Create a new Web Service, select the `backend/` directory, set runtime to Python,
  ```
  set the start command to `flask run --host=0.0.0.0 --port=5000`
  ```
- [ ] Add your environment variables (`OPENAI_API_KEY`, `DATABASE_URL`) in Render's
  ```
  environment settings panel
  ```
- [ ] Deploy and hit the `/api/health` endpoint to confirm it is live

**Frontend on Vercel:**

- [ ] Go to vercel.com, create a free account, connect your GitHub repo
- [ ] Import the project, set the root directory to `frontend/`, Vercel will auto-detect
  ```
  it as a React app
  ```
- [ ] Add an environment variable `REACT_APP_API_URL` pointing to your live Render
  ```
  backend URL
  ```
- [ ] Update your `api.js` Axios base URL to use `process.env.REACT_APP_API_URL`
- [ ] Deploy and test the live site end to end

**Database:**

- [ ] Your Neon database is already hosted. Make sure your Render backend's `DATABASE_URL`
  ```
  points to the Neon connection string, not a local one.
  ```
- [ ] Run your schema and seed script once against the production Neon database.

---



## Phase 10: CI/CD and Documentation (Day 6)

**CI/CD:**

- [ ] `.github/workflows/ci.yml` — run `pytest` on the backend and lint with `flake8` on
  ```
  every push to any branch
  ```
- [ ] Vercel and Render both auto-deploy on push to `main` once connected, so your deploy
  ```
  pipeline is already handled
  ```
- [ ] Push a small change, confirm the Actions tab goes green and the live site updates

**Documentation:**

- [ ] Architecture diagram in Excalidraw (free) showing:
  ```
  User input → React frontend → Flask API → Scraper → Two LLM calls (Mapping Engine
  + Discovery Engine) → PostgreSQL (use_cases + pending_use_cases + evaluations) →
  Human review flow → Master library update → Response back to frontend
  ```
- [ ] Record a short demo showing:
  - Enter a vendor URL
  - Evaluation runs
  - Mapping results appear
  - New use case discovered section appears
  - Navigate to the library review page
  - Approve the new use case
  - Run a second vendor and show the new use case is now being evaluated against
  - Convert to GIF with ezgif.com or keep as MP4
- [ ] README:
  - Project title and one-paragraph overview
  - Demo GIF at the top
  - Live demo link
  - Tech stack badges from shields.io
  - How it works section covering both the mapping flow and the discovery flow
  - Local development setup instructions
  - Architecture diagram
  - Use case library overview
  - Future improvements section
  - License and contact

**Future improvements to mention in your README:**

- ML-based confidence scoring trained on manually labeled evaluations
- Batch vendor evaluation via CSV upload
- Scheduled re-evaluation to track how vendor capabilities change over time
- Similarity scoring using embeddings to make the deduplication check more robust
than string matching
- Role-based access so multiple team members can collaborate on the review queue
- Exportable PDF report formatted for executive review

---



## Resume Bullet Points

*Built a full-stack IAM vendor evaluation tool using React, Flask, PostgreSQL, and the
OpenAI API that maps vendor capabilities to a 40+ use case library, automatically
discovers and queues new IAM use cases not in the master library for human review, and
appends approved ones to expand the library for future evaluations. Deployed on Vercel
and Render with GitHub Actions CI/CD.*