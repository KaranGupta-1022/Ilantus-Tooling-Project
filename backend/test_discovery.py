from db import get_connection, get_pending_use_cases, approve_pending_use_case, reject_pending_use_case
from mapping_engine import MappingEngine

engine = MappingEngine()

DOMAIN_CODE = "IGA"

VENDOR_NAME = "Test Vendor - Discovery Run"

VENDOR_TEXT = """
Our platform mines actual entitlement usage patterns across every connected
application to automatically discover natural role clusters, proposing optimized
role definitions based on what permissions groups of similar users actually use in
practice rather than requiring an administrator to hand-define roles up front. It
continuously flags role definitions that have drifted from real usage over time and
recommends role-splitting when a single role has grown to cover too many unrelated
permissions. We also generate a peer-comparison benchmark for every access request,
showing a requester how their entitlements compare to others in their department
before a manager approves or denies the request.
"""


def insert_temp_vendor():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO vendors (name, input_text) VALUES (%s, %s) RETURNING id;",
                (VENDOR_NAME, VENDOR_TEXT),
            )
            vendor_id = cur.fetchone()[0]
        conn.commit()
    return vendor_id


def cleanup(vendor_id):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM pending_use_cases WHERE vendor_id = %s;", (vendor_id,))
            cur.execute("DELETE FROM vendors WHERE id = %s;", (vendor_id,))
        conn.commit()
    print(f"\nCleaned up temp vendor id={vendor_id} and its pending_use_cases rows.")


def main():
    vendor_id = insert_temp_vendor()
    print(f"Inserted temp vendor id={vendor_id}")

    try:
        result = engine.map_vendor(vendor_text=VENDOR_TEXT, vendor_id=vendor_id, domain_code=DOMAIN_CODE)

        mapping = result["mapping"]
        if isinstance(mapping, dict) and "error" in mapping:
            print("Mapping failed:", mapping["error"])
        else:
            print(f"\nCovered ({len(mapping)}):")
            for m in mapping:
                print(f"  {m['use_case_code']} - {m['name']} (conf={m['confidence']})")

        new_use_cases = result["new_use_cases_found"]
        print(f"\nNew use cases discovered ({len(new_use_cases)}):")
        for uc in new_use_cases:
            print(f"  [{uc['id']}] {uc['suggested_code']} - {uc['suggested_name']}")
            print(f"      category: {uc['suggested_category']}")
            print(f"      description: {uc['suggested_description']}")
            print(f"      reasoning: {uc['llm_reasoning']}")

        if not new_use_cases:
            print("  (none — either the LLM found no genuinely new capabilities, "
                  "or everything matched an existing/pending use case.)")
            return

        pending_rows = get_pending_use_cases(domain_code=DOMAIN_CODE)
        print(f"\nget_pending_use_cases(domain_code='{DOMAIN_CODE}') returned {len(pending_rows)} row(s).")

        first = new_use_cases[0]
        new_use_case_id = approve_pending_use_case(first["id"])
        print(f"\nApproved pending id={first['id']} -> new use_cases.id={new_use_case_id}")

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT code, name, source FROM use_cases WHERE id = %s;",
                    (new_use_case_id,),
                )
                print("Confirmed in use_cases:", cur.fetchone())

        if len(new_use_cases) > 1:
            second = new_use_cases[1]
            reject_pending_use_case(second["id"])
            print(f"Rejected pending id={second['id']}")

            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT status FROM pending_use_cases WHERE id = %s;",
                        (second["id"],),
                    )
                    print("Confirmed status:", cur.fetchone())
        else:
            print("Only one new use case found — skipping reject test this run.")

    finally:
        cleanup(vendor_id)


if __name__ == "__main__":
    main()
