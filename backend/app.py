import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from db import get_connection

from urllib.parse import urlparse

from mapping_engine import MappingEngine
from scraper import crawl_vendor_site

from db import (
    approve_pending_use_case,
    get_connection,
    get_pending_use_cases,
    reject_pending_use_case,
    update_pending_use_case,
)


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = Flask(__name__)
CORS(app)
mapping_engine = MappingEngine()


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/domains", methods=["GET"])
def list_domains():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, code, name, description FROM domains ORDER BY code;")
            rows = cur.fetchall()

    domains = [
        {"id": row[0], "code": row[1], "name": row[2], "description": row[3]}
        for row in rows
    ]
    return jsonify(domains)


@app.route("/api/use-cases", methods=["GET"])
def list_use_cases():
    domain_code = request.args.get("domain")
    if not domain_code:
        return jsonify({"error": "domain query parameter is required"}), 400

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM domains WHERE code = %s;", (domain_code,))
            domain_row = cur.fetchone()
            if domain_row is None:
                return jsonify({"error": f"Unknown domain code '{domain_code}'"}), 400

            cur.execute(
                """
                SELECT id, code, name, category, description, source
                FROM use_cases
                WHERE domain_id = %s
                ORDER BY code;
                """,
                (domain_row[0],),
            )
            rows = cur.fetchall()

    use_cases = [
        {
            "id": row[0],
            "code": row[1],
            "name": row[2],
            "category": row[3],
            "description": row[4],
            "source": row[5],
        }
        for row in rows
    ]
    return jsonify(use_cases)

def _is_valid_url(value):
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    body = request.get_json(silent=True) or {}

    vendor_name = (body.get("vendor_name") or "").strip()
    input_type = (body.get("input_type") or "").strip().lower()
    input_value = (body.get("input_value") or "").strip()
    domain_code = (body.get("domain_code") or "").strip()

    if not vendor_name:
        return jsonify({"error": "vendor_name is required"}), 400
    if input_type not in ("url", "text"):
        return jsonify({"error": "input_type must be 'url' or 'text'"}), 400
    if not input_value:
        return jsonify({"error": "input_value is required"}), 400
    if input_type == "url" and not _is_valid_url(input_value):
        return jsonify({"error": "input_value must be a valid http(s) URL"}), 400
    if not domain_code:
        return jsonify({"error": "domain_code is required"}), 400

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM domains WHERE code = %s;", (domain_code,))
            domain_row = cur.fetchone()
    if domain_row is None:
        return jsonify({"error": f"Unknown domain code '{domain_code}'"}), 400
    domain_id = domain_row[0]

    pages_crawled = None
    if input_type == "url":
        try:
            crawl_result = crawl_vendor_site(input_value, max_pages=8)
        except Exception as exc:
            return jsonify({"error": f"Failed to crawl URL: {exc}"}), 502
        vendor_text = crawl_result["text"]
        pages_crawled = crawl_result["pages_crawled"]
        if not vendor_text.strip():
            return jsonify({"error": "Crawl succeeded but no usable text was found on the site"}), 422
    else:
        vendor_text = input_value

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM vendors
                WHERE domain_id = %s AND LOWER(name) = LOWER(%s);
                """,
                (domain_id, vendor_name),
            )
            existing = cur.fetchone()
            if existing is not None:
                old_vendor_id = existing[0]
                cur.execute("DELETE FROM evaluations WHERE vendor_id = %s;", (old_vendor_id,))
                cur.execute("DELETE FROM pending_use_cases WHERE vendor_id = %s;", (old_vendor_id,))
                cur.execute("DELETE FROM vendors WHERE id = %s;", (old_vendor_id,))

            cur.execute(
                """
                INSERT INTO vendors (name, input_text, domain_id, input_type, pages_crawled)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, created_at;
                """,
                (vendor_name, vendor_text, domain_id, input_type, pages_crawled),
            )
            vendor_id, created_at = cur.fetchone()
        conn.commit()

    results = mapping_engine.map_vendor(vendor_text, vendor_id, domain_code)
    mapping_results = results["mapping"]
    new_use_cases_found = results["new_use_cases_found"]

    if isinstance(mapping_results, dict) and "error" in mapping_results:
        return jsonify({"error": "Mapping engine failed", "details": mapping_results}), 502

    covered_by_code = {
        item["use_case_code"]: item for item in mapping_results if "use_case_code" in item
    }

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, code, name, category, description
                FROM use_cases
                WHERE domain_id = %s AND source IN ('manual', 'llm_approved')
                ORDER BY code;
                """,
                (domain_id,),
            )
            all_use_cases = cur.fetchall()

            reconciled = []
            for uc_id, code, name, category, description in all_use_cases:
                match = covered_by_code.get(code)
                covered = match is not None
                confidence = match["confidence"] if covered else None
                reasoning = match.get("reasoning") if covered else None

                cur.execute(
                    """
                    INSERT INTO evaluations (vendor_id, use_case_id, covered, confidence, reasoning)
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    (vendor_id, uc_id, covered, confidence, reasoning),
                )

                reconciled.append(
                    {
                        "use_case_id": uc_id,
                        "use_case_code": code,
                        "name": name,
                        "category": category,
                        "description": description,
                        "covered": covered,
                        "confidence": confidence,
                        "reasoning": reasoning,
                    }
                )
        conn.commit()

    return jsonify(
        {
            "vendor": {
                "id": vendor_id,
                "name": vendor_name,
                "domain_code": domain_code,
                "input_type": input_type,
                "pages_crawled": pages_crawled,
                "word_count": len(vendor_text.split()),
                "created_at": created_at.isoformat(),
            },
            "mapping": reconciled,
            "new_use_cases_found": new_use_cases_found,
        }
    ), 201

@app.route("/api/vendors", methods=["GET"])
def list_vendors():
    domain_code = request.args.get("domain")

    query = """
        SELECT v.id, v.name, v.input_type, v.pages_crawled, v.created_at, d.code,
               COUNT(e.id) AS use_cases_total,
               COALESCE(SUM(CASE WHEN e.covered THEN 1 ELSE 0 END), 0) AS use_cases_covered
        FROM vendors v
        JOIN domains d ON v.domain_id = d.id
        LEFT JOIN evaluations e ON e.vendor_id = v.id
    """
    params = ()
    if domain_code:
        query += " WHERE d.code = %s"
        params = (domain_code,)
    query += """
        GROUP BY v.id, v.name, v.input_type, v.pages_crawled, v.created_at, d.code
        ORDER BY v.created_at DESC;
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    vendors = [
        {
            "id": row[0],
            "name": row[1],
            "input_type": row[2],
            "pages_crawled": row[3],
            "created_at": row[4].isoformat(),
            "domain_code": row[5],
            "use_cases_total": row[6],
            "use_cases_covered": row[7],
            "coverage": round(row[7] / row[6] * 100) if row[6] else 0,
        }
        for row in rows
    ]
    return jsonify(vendors)


@app.route("/api/vendors/<int:vendor_id>", methods=["GET"])
def get_vendor(vendor_id):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.name, v.input_type, v.pages_crawled, v.created_at, d.code
                FROM vendors v
                JOIN domains d ON v.domain_id = d.id
                WHERE v.id = %s;
                """,
                (vendor_id,),
            )
            vendor_row = cur.fetchone()
            if vendor_row is None:
                return jsonify({"error": f"No vendor with id={vendor_id}"}), 404

            cur.execute(
                """
                SELECT uc.code, uc.name, uc.category, uc.description,
                       e.covered, e.confidence, e.reasoning
                FROM evaluations e
                JOIN use_cases uc ON e.use_case_id = uc.id
                WHERE e.vendor_id = %s
                ORDER BY uc.code;
                """,
                (vendor_id,),
            )
            eval_rows = cur.fetchall()

            cur.execute(
                """
                SELECT id, suggested_code, suggested_name, suggested_category,
                       suggested_description, llm_reasoning, status
                FROM pending_use_cases
                WHERE vendor_id = %s AND status = 'pending'
                ORDER BY id;
                """,
                (vendor_id,),
            )
            pending_rows = cur.fetchall()

    vendor = {
        "id": vendor_row[0],
        "name": vendor_row[1],
        "input_type": vendor_row[2],
        "pages_crawled": vendor_row[3],
        "created_at": vendor_row[4].isoformat(),
        "domain_code": vendor_row[5],
        "mapping": [
            {
                "use_case_code": row[0],
                "name": row[1],
                "category": row[2],
                "description": row[3],
                "covered": row[4],
                "confidence": row[5],
                "reasoning": row[6],
            }
            for row in eval_rows
        ],
        "new_use_cases_found": [
            {
                "id": row[0],
                "suggested_code": row[1],
                "suggested_name": row[2],
                "suggested_category": row[3],
                "suggested_description": row[4],
                "llm_reasoning": row[5],
            }
            for row in pending_rows
        ],
    }
    return jsonify(vendor)


@app.route("/api/compare", methods=["GET"])
def compare_vendors():
    ids_param = request.args.get("ids", "")
    try:
        vendor_ids = [int(x) for x in ids_param.split(",") if x.strip()]
    except ValueError:
        return jsonify({"error": "ids must be a comma-separated list of integers"}), 400

    if not vendor_ids:
        return jsonify({"error": "ids query parameter is required"}), 400

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.name, d.code
                FROM vendors v
                JOIN domains d ON v.domain_id = d.id
                WHERE v.id = ANY(%s);
                """,
                (vendor_ids,),
            )
            vendor_rows = cur.fetchall()

            found_ids = {row[0] for row in vendor_rows}
            missing = [vid for vid in vendor_ids if vid not in found_ids]
            if missing:
                return jsonify({"error": f"No vendor(s) with id(s): {missing}"}), 404

            domain_codes = {row[2] for row in vendor_rows}
            if len(domain_codes) > 1:
                return jsonify({"error": "Cannot compare vendors from different domains", "domains": list(domain_codes)}), 400

            cur.execute(
                """
                SELECT e.vendor_id, uc.code, uc.name, uc.category, e.covered, e.confidence
                FROM evaluations e
                JOIN use_cases uc ON e.use_case_id = uc.id
                WHERE e.vendor_id = ANY(%s)
                ORDER BY uc.code;
                """,
                (vendor_ids,),
            )
            eval_rows = cur.fetchall()

    vendors_by_id = {row[0]: {"id": row[0], "name": row[1]} for row in vendor_rows}

    mapping_by_vendor = {}
    for vendor_id, code, name, category, covered, confidence in eval_rows:
        mapping_by_vendor.setdefault(vendor_id, []).append(
            {
                "use_case_code": code,
                "name": name,
                "category": category,
                "covered": covered,
                "confidence": confidence,
            }
        )

    return jsonify(
        {
            "domain_code": domain_codes.pop(),
            "vendors": [
                {**vendors_by_id[vid], "mapping": mapping_by_vendor.get(vid, [])}
                for vid in vendor_ids
            ],
        }
    )

@app.route("/api/pending-use-cases", methods=["GET"])
def list_pending_use_cases():
    domain_code = request.args.get("domain")
    pending = get_pending_use_cases(domain_code)
    for row in pending:
        row["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
    return jsonify(pending)


@app.route("/api/pending-use-cases/<int:pending_id>/approve", methods=["POST"])
def approve_pending(pending_id):
    try:
        new_use_case_id = approve_pending_use_case(pending_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"use_case_id": new_use_case_id}), 200


@app.route("/api/pending-use-cases/<int:pending_id>/reject", methods=["POST"])
def reject_pending(pending_id):
    try:
        reject_pending_use_case(pending_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"status": "rejected"}), 200


@app.route("/api/pending-use-cases/<int:pending_id>", methods=["PATCH"])
def patch_pending(pending_id):
    body = request.get_json(silent=True) or {}
    if not body:
        return jsonify({"error": "Request body must include at least one field to update"}), 400

    if "domain_code" in body:
        domain_code = (body.pop("domain_code") or "").strip()
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM domains WHERE code = %s;", (domain_code,))
                domain_row = cur.fetchone()
        if domain_row is None:
            return jsonify({"error": f"Unknown domain code '{domain_code}'"}), 400
        body["suggested_domain_id"] = domain_row[0]

    try:
        update_pending_use_case(pending_id, body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"status": "updated"}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
