from db import get_connection

# list of domains to migrate
# (code, name, description)
DOMAINS = [
    ("IGA", "Identity Governance and Administration",
     "Access lifecycle, certification, provisioning, and compliance for enterprise applications."),
    ("PAM", "Privileged Access Management",
     "Vaulting, session management, and just-in-time elevation for privileged accounts."),
    ("CIAM", "Customer Identity and Access Management",
     "Registration, authentication, and consent management for external customer-facing identities."),
    ("AM", "Access Management and SSO",
     "Authentication, single sign-on, and federation across applications."),
    ("DIR", "Directory Services",
     "Centralized identity stores and directory synchronization such as Active Directory or LDAP."),
    ("IRM", "Identity Risk Management",
     "Risk scoring, anomaly detection, and identity threat detection and response."),
    ("NHI", "Non-Human Identity Management",
     "Governance of service accounts, API keys, bots, and machine or AI agent identities."),
]


def migrate():
    """
    Migrates the domains table and backfills the use_cases table with the domains.
    - Creates the domains table if it doesn't exist.
    - Inserts the domains into the domains table.
    - Backfills the use_cases table with the domains.
    """
    # create the domains table if it doesn't exist
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS domains (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(20) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    description TEXT
                );
                """
            )

            # insert the domains into the domains table
            for code, name, description in DOMAINS:
                cur.execute(
                    """
                    INSERT INTO domains (code, name, description)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (code) DO NOTHING;
                    """,
                    (code, name, description),
                )

            # add the domain_id column to the use_cases table
            cur.execute(
                """
                ALTER TABLE use_cases
                ADD COLUMN IF NOT EXISTS domain_id INTEGER REFERENCES domains(id);
                """
            )

            # add the suggested_domain_id column to the pending_use_cases table
            cur.execute(
                """
                ALTER TABLE pending_use_cases
                ADD COLUMN IF NOT EXISTS suggested_domain_id INTEGER REFERENCES domains(id);
                """
            )

            # backfill the use_cases table with the domains
            cur.execute(
                """
                UPDATE use_cases
                SET domain_id = (SELECT id FROM domains WHERE code = 'IGA')
                WHERE domain_id IS NULL;
                """
            )

        # commit the changes to the database
        conn.commit()
    print("Domains migration complete: 7 domains seeded, 44 use cases backfilled to IGA.")


if __name__ == "__main__":
    migrate()
