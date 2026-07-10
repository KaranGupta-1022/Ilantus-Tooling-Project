from db import get_connection


def migrate():
    """
    Extends the vendors table with the columns Phase 5 needs:
    - domain_id: which IAM domain this vendor evaluation belongs to.
    - input_type: 'url' or 'text', so the API can show how the vendor was evaluated.
    - pages_crawled: number of pages the scraper visited (NULL for text input).
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE vendors
                ADD COLUMN IF NOT EXISTS domain_id INTEGER REFERENCES domains(id);
                """
            )
            cur.execute(
                """
                ALTER TABLE vendors
                ADD COLUMN IF NOT EXISTS input_type VARCHAR(10);
                """
            )
            cur.execute(
                """
                ALTER TABLE vendors
                ADD COLUMN IF NOT EXISTS pages_crawled INTEGER;
                """
            )
        conn.commit()
    print("Vendors migration complete: domain_id, input_type, pages_crawled added.")


if __name__ == "__main__":
    migrate()
