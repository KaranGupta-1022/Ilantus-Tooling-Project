# Ilantus-Tooling-Project
A full-stack web app that takes a vendor's website URL or product description as input, uses an LLM to extract and map their capabilities to a master IAM use case library, and outputs a structured gap analysis showing what the vendor covers and what they miss. If the LLM identifies a capability not in the master library, it flags it as a new use case, queues it for human review, and appends it to the library upon approval.

## Prerequisites

- Python 3.11+
- Node.js (for the frontend, added in a later phase)
- Docker Desktop (optional — only needed if using local Postgres instead of Neon)

## Local Setup (Backend)

1. Navigate into `backend/`:

       cd backend

2. Create and activate a virtual environment:

       python -m venv venv
       .\venv\Scripts\Activate.ps1

3. Install dependencies:

       pip install -r requirements.txt

4. Create a `.env` file at the project root with:

       GROQ_API_KEY=your_groq_key_here
       DATABASE_URL=your_neon_connection_string_here

5. Verify the setup:

       python verify_setup.py

## Local Postgres (optional)

Instead of Neon, you can run Postgres locally with Docker:

    docker-compose up -d