import os
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_connection():
    """
    Gets a connection to the database.
    """
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

def get_pending_use_cases(domain_code=None):
    """
    Returns pending use cases, optionally filtered by domain_code.
    Only rows with status='pending' are returned (approved/rejected are excluded).
    """
    query = """
        SELECT p.id, p.vendor_id, p.suggested_code, p.suggested_domain_id, d.code,
               p.suggested_name, p.suggested_category, p.suggested_description,
               p.llm_reasoning, p.status, p.created_at
        FROM pending_use_cases p
        JOIN domains d ON p.suggested_domain_id = d.id
        WHERE p.status = 'pending'
    """
    params = ()
    if domain_code:
        query += " AND d.code = %s"
        params = (domain_code,)
    query += " ORDER BY p.created_at DESC;"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "vendor_id": row[1],
            "suggested_code": row[2],
            "suggested_domain_id": row[3],
            "domain_code": row[4],
            "suggested_name": row[5],
            "suggested_category": row[6],
            "suggested_description": row[7],
            "llm_reasoning": row[8],
            "status": row[9],
            "created_at": row[10],
        }
        for row in rows
    ]

def approve_pending_use_case(pending_id):
    """
    Moves a pending use case into the master use_cases library with
    source='llm_approved', using suggested_domain_id as the real domain_id.
    Marks the pending row as approved and returns the new use_case id.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT suggested_code, suggested_domain_id, suggested_name,
                       suggested_category, suggested_description
                FROM pending_use_cases
                WHERE id = %s AND status = 'pending';
                """,
                (pending_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise ValueError(f"No pending use case with id={pending_id} and status='pending'")

            code, domain_id, name, category, description = row

            cur.execute(
                """
                INSERT INTO use_cases (code, name, category, description, source, domain_id)
                VALUES (%s, %s, %s, %s, 'llm_approved', %s)
                RETURNING id;
                """,
                (code, name, category, description, domain_id),
            )
            new_use_case_id = cur.fetchone()[0]

            cur.execute(
                """
                UPDATE pending_use_cases
                SET status = 'approved', reviewed_at = NOW()
                WHERE id = %s;
                """,
                (pending_id,),
            )

        conn.commit()

    return new_use_case_id 

def update_pending_use_case(pending_id, fields):
    """
    Updates one or more suggested_* fields on a pending use case before approval.
    `fields` is a dict whose keys may include: suggested_code, suggested_name,
    suggested_category, suggested_description. Only status='pending' rows may be edited.
    """
    allowed_columns = {
        "suggested_code",
        "suggested_name",
        "suggested_category",
        "suggested_description",
        "suggested_domain_id",
    }
    
    updates = {k: v for k, v in fields.items() if k in allowed_columns}
    if not updates:
        raise ValueError("No valid fields to update")

    set_clause = ", ".join(f"{col} = %s" for col in updates)
    params = list(updates.values()) + [pending_id]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE pending_use_cases
                SET {set_clause}
                WHERE id = %s AND status = 'pending';
                """,
                params,
            )
            updated = cur.rowcount
        conn.commit()

    if updated == 0:
        raise ValueError(f"No pending use case with id={pending_id} and status='pending'")
        

def reject_pending_use_case(pending_id):
    """
    Marks a pending use case as rejected without touching use_cases.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pending_use_cases
                SET status = 'rejected', reviewed_at = NOW()
                WHERE id = %s AND status = 'pending';
                """,
                (pending_id,),
            )
            updated = cur.rowcount
        conn.commit()

    if updated == 0:
        raise ValueError(f"No pending use case with id={pending_id} and status='pending'")