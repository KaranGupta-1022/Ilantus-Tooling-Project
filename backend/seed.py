from db import get_connection

USE_CASES = [
    # --- C: Create / Onboard ---
    ("C1", "Application Discovery", "Create",
     "Scans the organization to identify unknown or unmanaged applications that are not yet under IGA governance.",
     "IGA", "manual"),
    ("C2", "Entitlement Discovery", "Create",
     "Extracts roles and permissions from an application that has no native API or SCIM endpoint.",
     "IGA", "manual"),
    ("C3", "Connector Build", "Create",
     "Builds an IGA connector for an application that does not support SCIM natively.",
     "IGA", "manual"),
    ("C4", "Full Integration Lifecycle", "Create",
     "Manages the complete connector build process from initial configuration and role modeling to ongoing maintenance.",
     "IGA", "manual"),
    ("C5", "Proactive Vendor API Maintenance", "Create",
     "Monitors target application APIs for breaking changes and handles the migration pipeline automatically.",
     "IGA", "manual"),
    ("C6", "Artifact Generation", "Create",
     "Produces a compliance package including documentation, runbooks, and entitlement maps for every integration built.",
     "IGA", "manual"),
    ("C7", "Self-Service Pipeline and Mass Migrations", "Create",
     "Automates the end-to-end integration pipeline for large-scale events such as mergers, acquisitions, or cloud migrations.",
     "IGA", "manual"),
    ("C8", "Pre-Flight Compliance Checking", "Create",
     "Runs compliance scoring against frameworks like SOX, HIPAA, and GDPR before any configuration is pushed to a system.",
     "IGA", "manual"),
    ("C9", "Lifecycle and Access Control", "Create",
     "Automates Joiner, Mover, and Leaver workflows including birthright provisioning based on authoritative HR attributes.",
     "IGA", "manual"),
    ("C10", "ITSM Ticket Generation", "Create",
     "Automatically translates HR lifecycle events into service tickets in ServiceNow, Jira, or Freshservice for disconnected physical provisioning tasks.",
     "IGA", "manual"),
    ("C11", "B2B Partner IAM", "Create",
     "Centralizes external partner access by allowing partners to use their own IdPs while filtering domains and attributes to restrict visibility.",
     "IGA", "manual"),
    ("C12", "Zero-Touch Service Desk Remediation", "Create",
     "Automates routine identity tickets such as password resets and account unlocks directly within ITSM platforms without human intervention.",
     "IGA", "manual"),

    # --- R: Read / Identify / Certify ---
    ("R1", "Access Visibility", "Read",
     "Shows who has what access across all connected and disconnected applications in a single unified view.",
     "IGA", "manual"),
    ("R2", "Entitlement Mapping", "Read",
     "Maps raw application-level roles and permissions to business-level roles in the IGA role catalog.",
     "IGA", "manual"),
    ("R3", "Continuous Entitlement Aggregation", "Read",
     "Pulls entitlement data directly from disconnected applications on demand to support access reviews without a native API.",
     "IGA", "manual"),
    ("R4", "Orphan Account Detection", "Read",
     "Identifies accounts in an application that have no corresponding active identity in the IGA.",
     "IGA", "manual"),
    ("R5", "Orphan Account and Drift Cleanup", "Read",
     "Continuously identifies and removes unmanaged accounts and accumulated entitlements with no active owner.",
     "IGA", "manual"),
    ("R6", "Access Certification", "Read",
     "Enables managers to review and approve or revoke specific user entitlements on a scheduled or triggered basis.",
     "IGA", "manual"),
    ("R7", "People Analytics", "Read",
     "Streams incremental workforce data from HR systems into SQL databases for advanced business intelligence analytics.",
     "IGA", "manual"),
    ("R8", "Automated Evidence Collection", "Read",
     "Captures audit-ready access logs documenting who requested, approved, and executed every permission change.",
     "IGA", "manual"),
    ("R9", "SaaS License and Spend Optimization", "Read",
     "Analyzes tool adoption, flags duplicate or inactive licenses, and surfaces wasted SaaS spend for reclamation.",
     "IGA", "manual"),

    # --- U: Update / Modify ---
    ("U1", "Automated Lifecycle (JML) Management", "Update",
     "Automates Joiner, Mover, and Leaver workflows for applications that do not support SCIM, pushing custom entitlements that standard payloads cannot carry.",
     "IGA", "manual"),
    ("U2", "Fine-Grained Modification", "Update",
     "Changes a specific in-application permission without re-provisioning the user's full access set.",
     "IGA", "manual"),
    ("U3", "Attribute Sync", "Update",
     "Keeps user attributes such as name, email, and department synchronized between the IGA and the target application.",
     "IGA", "manual"),
    ("U4", "SoD Policy Enforcement", "Update",
     "Detects and remediates Separation of Duties conflicts within a single application's permission set.",
     "IGA", "manual"),
    ("U5", "Policy Enforcement", "Update",
     "Detects and remediates broader access policy violations beyond SoD within a disconnected application.",
     "IGA", "manual"),
    ("U6", "AI-Powered Password and Credential Rotation", "Update",
     "Automates credential rotation across applications and break-glass admin accounts and syncs updates back to PAM vaults.",
     "IGA", "manual"),
    ("U7", "Fraud Prevention", "Update",
     "Uses AI-driven behavioral analytics and risk scoring to detect fraud patterns and trigger step-up authentication.",
     "IGA", "manual"),
    ("U8", "MFA Injection and Enforcement", "Update",
     "Auto-enrolls users and auto-fills second-factor codes for legacy applications that lack native enterprise MFA support.",
     "IGA", "manual"),
    ("U9", "Enterprise Password Management and Sharing", "Update",
     "Provides built-in password generation, secure credential autofill, and auditable credential sharing for internal teams and external contractors.",
     "IGA", "manual"),

    # --- D: Delete / Revoke / Deprovision ---
    ("D1", "Instant Access Revocation", "Delete",
     "Deactivates accounts and removes stale privileges directly inside a disconnected application during an offboarding event.",
     "IGA", "manual"),
    ("D2", "Selective Revocation", "Delete",
     "Removes one specific entitlement from a user without disabling their account or affecting their other access.",
     "IGA", "manual"),
    ("D3", "Certification-Triggered Revocation", "Delete",
     "Automatically removes access directly inside the application when a reviewer denies it during a certification campaign.",
     "IGA", "manual"),

    # --- GEN: General / Cross-cutting ---
    ("GEN-1", "Access Certification", "General",
     "Enables managers to review and approve or revoke specific user entitlements on a scheduled or triggered basis, applicable across all application types.",
     "IGA", "manual"),
    ("GEN-2", "Application Discovery", "General",
     "Surfaces unknown or ungoverned applications before they are formally onboarded to the IGA, applicable across all vendors and evaluation contexts.",
     "IGA", "manual"),
    ("GEN-3", "Entitlement Mapping", "General",
     "Maps raw application roles to business-level roles in the IGA catalog, applicable across all application types.",
     "IGA", "manual"),
    ("GEN-4", "SoD Policy Enforcement", "General",
     "Detects and remediates Separation of Duties conflicts within a single application's permission set, applicable across all application types.",
     "IGA", "manual"),
    ("GEN-5", "Certification-Triggered Revocation", "General",
     "Executes access removal inside the application when a certification reviewer denies access, applicable across all application types.",
     "IGA", "manual"),
    ("GEN-6", "Selective Revocation", "General",
     "Removes one specific entitlement from a user without affecting their other access, applicable across all application types.",
     "IGA", "manual"),
    ("GEN-7", "Fine-Grained Role Modification", "General",
     "Updates a specific in-application permission without a full re-provisioning cycle, applicable across all application types.",
     "IGA", "manual"),
    ("GEN-8", "Physical Access Control Governance", "General",
     "Extends IGA lifecycle events to badge and door access systems so offboarding revokes both logical and physical access simultaneously.",
     "IGA", "manual"),
    ("GEN-9", "Shared and Generic Account Governance", "General",
     "Assigns ownership and enforces lifecycle rules on shared accounts and generic IDs not tied to a single person.",
     "IGA", "manual"),
    ("GEN-10", "OT and SCADA Identity Governance", "General",
     "Manages user access on operational technology systems that are air-gapped from corporate identity infrastructure.",
     "IGA", "manual"),
    ("GEN-11", "Machine Identity and AI Agent Certification", "General",
     "Certifies the service accounts, API keys, and AI agent credentials used by integration tools to connect the IGA to disconnected applications.",
     "IGA", "manual"),
]


def seed():
    """ 
    Seeds the use cases into the database.
    - Gets the domain ids from the domains table.
    - Inserts the use cases into the use_cases table.   
    """
    # get a connection to the database
    with get_connection() as conn:
        # get a cursor to the database
        with conn.cursor() as cur:
            # get the domain ids from the domains table
            cur.execute("SELECT code, id FROM domains")
            domain_ids = {code: domain_id for code, domain_id in cur.fetchall()}

            for code, name, category, description, domain_code, source in USE_CASES:
                # insert the use case into the use_cases table
                cur.execute(
                    """
                    INSERT INTO use_cases (code, name, category, description, source, domain_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (code) DO NOTHING;
                    """,
                    (code, name, category, description, source, domain_ids[domain_code]),
                )
        conn.commit()
    print(f"Seed complete. Attempted to insert {len(USE_CASES)} use cases.")


if __name__ == "__main__":
    seed()
