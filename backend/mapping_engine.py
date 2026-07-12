import json
import os

from dotenv import load_dotenv
from openai import OpenAI

from db import get_connection

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

""" 
- Gets the Groq API key from the environment variables.
- Gets the Groq base URL from the environment variables.
"""
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
MODEL = "llama-3.3-70b-versatile"


class MappingEngine:
    def __init__(self):
        """
        - Creates a client for the Groq API.
        """
        self.client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)

    def _load_use_cases(self, domain_code="IGA"):
        """
        - Joins use_cases to domains so it can filter by the domain's code (e.g. "IGA") rather than an internal domain_id.
        - Filters source IN ('manual', 'llm_approved') so it excludes anything still sitting as a pending discovery suggestion.
        - Raw tuples are converted to list of dicts (code, name, category, description) so it can be used downstream.
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT uc.code, uc.name, uc.category, uc.description
                    FROM use_cases uc
                    JOIN domains d ON uc.domain_id = d.id
                    WHERE d.code = %s
                      AND uc.source IN ('manual', 'llm_approved')
                    ORDER BY uc.code;
                    """,
                    (domain_code,),
                )
                rows = cur.fetchall()

        return [
            {"code": code, "name": name, "category": category, "description": description}
            for code, name, category, description in rows
        ]

    def _get_next_code(self, category_prefix, domain_id):
        """
        - Finds the highest existing numeric suffix for a given code prefix
          (e.g. "C", "R", "U", "D", "GEN") within a single domain.
        - Looks at both approved use_cases and still-pending suggestions so two
          concurrent evaluations can't collide on the same code.
        - Returns prefix + (max + 1), e.g. "C13" if "C12" is the current highest.
        """
        pattern = f"{category_prefix}%"

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT code FROM use_cases
                    WHERE domain_id = %s AND code LIKE %s
                    UNION
                    SELECT suggested_code FROM pending_use_cases
                    WHERE suggested_domain_id = %s AND suggested_code LIKE %s;
                    """,
                    (domain_id, pattern, domain_id, pattern),
                )
                rows = cur.fetchall()

        max_number = 0
        for (code,) in rows:
            if not code or not code.startswith(category_prefix):
                continue
            suffix = code[len(category_prefix):]
            if suffix.isdigit():
                max_number = max(max_number, int(suffix))

        return f"{category_prefix}{max_number + 1}"


    def _call_llm(self, prompt):
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()

    def _parse_json_array(self, raw_output):
        try:
            return json.loads(raw_output)
        except json.JSONDecodeError:
            return None

    def _run_mapping(self, vendor_text, use_cases, domain_name):
        """
        - Runs the mapping engine for a given vendor text and use cases.
        - Returns a list of use cases that are covered by the vendor text in the form of a JSON array.
        - Creates a list of use cases.
        - Creates a prompt for the mapping engine.
        - Runs the mapping engine, retrying once if the response isn't valid JSON.
        - Returns the result of the mapping engine.
        """
        use_case_list = "\n".join(
            f"{uc['code']}: {uc['name']} - {uc['description'].split('.')[0]}."
            for uc in use_cases
        )

        prompt = f"""IAM expert task: evaluate a vendor's product against the {domain_name} use case library.

Use cases:
{use_case_list}

Vendor text:
{vendor_text}

Return a JSON array containing ONLY the use cases the vendor's product covers (skip any not covered). Each object:
{{"use_case_code": str, "name": str, "confidence": float, "reasoning": str}}

Rules:
- Evidence-based only. Generic phrases like "automates identity governance" do not count as evidence for any specific use case.
- confidence: 0.9-1.0 for an explicit match, 0.6-0.8 for a strong implication. Only include a use case if confidence >= 0.6.
- reasoning: one short sentence (max 15 words) citing the specific evidence from the vendor text that supports this match.
- Each use_case_code must appear AT MOST ONCE in the array. Never repeat a use case you have already included.
- Stop once you have evaluated every use case in the list above. Do not restate or re-evaluate use cases already covered.
- JSON array only. No markdown, no preamble. If nothing is covered, return [].
"""

        raw_output = self._call_llm(prompt)
        parsed = self._parse_json_array(raw_output)
        if parsed is not None:
            return parsed

        print("Failed to parse mapping response as JSON. Retrying once. Raw output:")
        print(raw_output)

        raw_output = self._call_llm(prompt)
        parsed = self._parse_json_array(raw_output)
        if parsed is not None:
            return parsed

        print("Mapping retry also failed to parse as JSON. Raw output:")
        print(raw_output)
        return {"error": "Failed to parse LLM response", "raw_output": raw_output}


    def _run_discovery(self, vendor_text, use_cases, vendor_id, domain_code):
        """
        - Second, separate Groq call: looks for vendor capabilities that represent
          genuinely new IAM use cases not already covered by the domain's library.
        - Parses the response defensively (same try/except pattern as _run_mapping).
        - For each new suggestion: overrides the LLM's code via _get_next_code,
          skips near-duplicates already sitting in pending_use_cases for this domain,
          and inserts the rest with status='pending'.
        - Returns the list of newly inserted pending use cases (with real DB ids)
          so map_vendor can surface them immediately.
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name FROM domains WHERE code = %s;", (domain_code,))
                domain_row = cur.fetchone()

        if domain_row is None:
            print(f"Unknown domain_code '{domain_code}', skipping discovery.")
            return []

        domain_id, domain_name = domain_row

        use_case_list = "\n".join(
            f"{uc['code']}: {uc['name']} - {uc['description']}"
            for uc in use_cases
        )

        prompt = f"""You are an IAM (Identity and Access Management) expert building a use case library
for the {domain_name} domain.

Below is the current master list of {domain_name} use cases. Each has a code, name, and description.

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
  does not exist anywhere in the master list for this domain.
- For each new use case you find, suggest a code that follows the existing pattern
  (C, R, U, D, or GEN followed by the next available number in that category).
- suggested_category MUST be exactly one of: "Create", "Read", "Update", "Delete",
  "General" (matching C/R/U/D/GEN respectively). Do not use the domain name or any
  other value as the category.
- Each array element MUST use exactly these five keys: "suggested_code",
  "suggested_name", "suggested_category", "suggested_description", "llm_reasoning".
  Do not rename, abbreviate, or omit any of them.
- JSON array only. No markdown, no preamble. If you find no new use cases, return [].
"""
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )


        raw_output = response.choices[0].message.content.strip()

        print("\n--- RAW DISCOVERY OUTPUT ---")
        print(raw_output)
        print("--- END RAW DISCOVERY OUTPUT ---\n")
    
        try:
            suggestions = json.loads(raw_output)
        except json.JSONDecodeError:
            print("Failed to parse discovery response as JSON. Raw output:")
            print(raw_output)
            return []

        if not isinstance(suggestions, list):
            print("Discovery response was valid JSON but not a list. Raw output:")
            print(raw_output)
            return []

        inserted = []
        next_number_by_prefix = {}

        with get_connection() as conn:
            with conn.cursor() as cur:
                for suggestion in suggestions:
                    suggested_name = (
                        suggestion.get("suggested_name") or suggestion.get("name") or ""
                    ).strip()
                    if not suggested_name:
                        continue

                    llm_code = suggestion.get("suggested_code") or suggestion.get("code") or "GEN1"
                    suggested_category = (
                        suggestion.get("suggested_category") or suggestion.get("category") or ""
                    )
                    suggested_description = (
                        suggestion.get("suggested_description") or suggestion.get("description") or ""
                    )
                    llm_reasoning = (
                        suggestion.get("llm_reasoning") or suggestion.get("reasoning") or ""
                    )

                    # skip if a near-duplicate already exists in the approved
                    # master library for this domain
                    cur.execute(
                        """
                        SELECT id FROM use_cases
                        WHERE domain_id = %s
                          AND LOWER(name) LIKE '%%' || LOWER(%s) || '%%'
                        LIMIT 1;
                        """,
                        (domain_id, suggested_name),
                    )
                    if cur.fetchone() is not None:
                        continue

                    # skip near-duplicates already pending/approved in this domain
                    cur.execute(
                        """
                        SELECT id FROM pending_use_cases
                        WHERE suggested_domain_id = %s
                          AND LOWER(suggested_name) LIKE '%%' || LOWER(%s) || '%%'
                        LIMIT 1;
                        """,
                        (domain_id, suggested_name),
                    )
                    if cur.fetchone() is not None:
                        continue


                    category_prefix = llm_code.rstrip("0123456789") or "GEN"

                    if category_prefix not in next_number_by_prefix:
                        first_code = self._get_next_code(category_prefix, domain_id)
                        next_number_by_prefix[category_prefix] = int(first_code[len(category_prefix):])
                    else:
                        next_number_by_prefix[category_prefix] += 1

                    final_code = f"{category_prefix}{next_number_by_prefix[category_prefix]}"

                    cur.execute(
                        """
                        INSERT INTO pending_use_cases
                            (vendor_id, suggested_code, suggested_domain_id, suggested_name,
                             suggested_category, suggested_description, llm_reasoning, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                        RETURNING id;
                        """,
                        (
                            vendor_id,
                            final_code,
                            domain_id,
                            suggested_name,
                            suggested_category,
                            suggested_description,
                            llm_reasoning,
                        ),
                    )
                    pending_id = cur.fetchone()[0]

                    inserted.append(
                        {
                            "id": pending_id,
                            "suggested_code": final_code,
                            "suggested_name": suggested_name,
                            "suggested_category": suggested_category,
                            "suggested_description": suggested_description,
                            "llm_reasoning": llm_reasoning,
                        }
                    )

            conn.commit()

        return inserted


    def map_vendor(self, vendor_text, vendor_id, domain_code="IGA"):
        """
        - Loads the use cases for a given domain code.
        - Runs the mapping engine for a given vendor text and use cases.
        - Runs the discovery engine for a given vendor text and use cases.
        - Returns a dictionary containing the mapping and discovery results.
        """
        use_cases = self._load_use_cases(domain_code)
        mapping_results = self._run_mapping(vendor_text, use_cases, domain_code)
        discovery_results = self._run_discovery(vendor_text, use_cases, vendor_id, domain_code)
        return {
            "mapping": mapping_results,
            "new_use_cases_found": discovery_results,
        }
