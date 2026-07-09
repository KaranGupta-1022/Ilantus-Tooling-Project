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

    def _run_mapping(self, vendor_text, use_cases, domain_name):
        """
        - Runs the mapping engine for a given vendor text and use cases.
        - Returns a list of use cases that are covered by the vendor text in the form of a JSON array.
        - Creates a list of use cases.
        - Creates a prompt for the mapping engine.
        - Runs the mapping engine.
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
{{"use_case_code": str, "name": str, "confidence": float}}

Rules:
- Evidence-based only. Generic phrases like "automates identity governance" do not count as evidence for any specific use case.
- confidence: 0.9-1.0 for an explicit match, 0.6-0.8 for a strong implication. Only include a use case if confidence >= 0.6.
- JSON array only. No markdown, no preamble. If nothing is covered, return [].
"""

        response = self.client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )

        raw_output = response.choices[0].message.content.strip()

        try:
            return json.loads(raw_output)
        except json.JSONDecodeError:
            print("Failed to parse mapping response as JSON. Raw output:")
            print(raw_output)
            return {"error": "Failed to parse LLM response", "raw_output": raw_output}


    def _run_discovery(self, vendor_text, use_cases, vendor_id, domain_code):
        """
        - Runs the discovery engine for a given vendor text and use cases.
        - Currently returns an empty list.
        """
        return []

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
