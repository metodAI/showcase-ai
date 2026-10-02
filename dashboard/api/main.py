from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg
import os
from dotenv import load_dotenv


load_dotenv()


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


def get_date_filter(days):
    if days is None:
        return "", ()

    if days == 1:
        return "AND created_at >= CURRENT_DATE", ()

    return (
        "AND created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')",
        (days,)
    )


@app.get("/")
def root():
    return {
        "message": "metodAI Dashboard API is running"
    }


@app.get("/dashboard/kpis")
def get_kpis(days: int | None = None):

    lead_filter, lead_params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    COUNT(*) AS leads_received,

                    COUNT(*) FILTER (
                        WHERE classification = 'MATCH'
                    ) AS qualified_leads,

                    COUNT(*) FILTER (
                        WHERE status = 'REVIEW'
                    ) AS review_required,

                    COUNT(*) FILTER (
                        WHERE status = 'SENT'
                    ) AS emails_sent,

                    ROUND(
                        AVG(score)
                        FILTER (
                            WHERE classification = 'MATCH'
                        ),
                        1
                    ) AS average_lead_score

                FROM leads
                WHERE 1 = 1
                {lead_filter}
                """,
                lead_params 
            )

            row = cursor.fetchone()

            return {
                "leads_received": row[0],
                "qualified_leads": row[1],
                "review_required": row[2],
                "emails_sent": row[3],
                "average_lead_score": (
                    float(row[4])
                    if row[4] is not None
                    else None
                )
            }


@app.get("/dashboard/statuses")
def get_statuses(days: int | None = None):

    lead_filter, params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    status,
                    COUNT(*) AS count
                FROM leads
                WHERE 1 = 1
                {lead_filter}
                GROUP BY status
                ORDER BY count DESC
                """,
                params
            )

            rows = cursor.fetchall()

            return [
                {
                    "status": row[0],
                    "count": row[1]
                }
                for row in rows
            ]


@app.get("/dashboard/classifications")
def get_classifications(days: int | None = None):

    lead_filter, params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    COALESCE(classification, 'UNCLASSIFIED') AS classification,
                    COUNT(*) AS count
                FROM leads
                WHERE 1 = 1
                {lead_filter}
                GROUP BY classification
                ORDER BY count DESC
                """,
                params
            )

            rows = cursor.fetchall()

            return [
                {
                    "classification": row[0],
                    "count": row[1]
                }
                for row in rows
            ]


@app.get("/dashboard/leads-over-time")
def get_leads_over_time(days: int | None = None):

    lead_filter, params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    DATE(created_at) AS date,
                    COUNT(*) AS count
                FROM leads
                WHERE 1 = 1
                {lead_filter}
                GROUP BY DATE(created_at)
                ORDER BY date
                """,
                params
            )

            rows = cursor.fetchall()

            return [
                {
                    "date": row[0].isoformat(),
                    "count": row[1]
                }
                for row in rows
            ]


@app.get("/dashboard/emails-over-time")
def get_emails_over_time(days: int | None = None):

    lead_filter, lead_params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    DATE(e.created_at) AS date,
                    COUNT(*) AS count
                FROM lead_events e
                JOIN leads l
                    ON l.lead_id = e.lead_id
                WHERE e.event_type = 'EMAIL_SENT'
                {lead_filter.replace("created_at", "l.created_at")}
                GROUP BY DATE(e.created_at)
                ORDER BY date
                """,
                lead_params
            )

            rows = cursor.fetchall()

            return [
                {
                    "date": row[0].isoformat(),
                    "count": row[1]
                }
                for row in rows
            ]

@app.get("/dashboard/automation-efficiency")
def get_automation_efficiency(days: int | None = None):

    lead_filter, lead_params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    COUNT(*) AS total_leads,

                    COUNT(*) FILTER (
                        WHERE status != 'REVIEW'
                    ) AS automated_leads,

                    COUNT(*) FILTER (
                        WHERE classification = 'MATCH'
                    ) AS qualified_leads,

                    COUNT(*) FILTER (
                        WHERE classification = 'MATCH'
                        AND status = 'SENT'
                    ) AS qualified_sent

                FROM leads
                WHERE 1 = 1
                {lead_filter}
                """,
                lead_params
            )

            row = cursor.fetchone()

            total_leads = row[0] or 0
            automated_leads = row[1] or 0
            qualified_leads = row[2] or 0
            qualified_sent = row[3] or 0

            return {
                "automation_rate": round(
                    automated_leads / total_leads * 100, 1
                ) if total_leads else 0,

                "qualification_rate": round(
                    qualified_leads / total_leads * 100, 1
                ) if total_leads else 0,

                "email_completion_rate": round(
                    qualified_sent / qualified_leads * 100, 1
                ) if qualified_leads else 0
            }

@app.get("/dashboard/recent-activity")
def get_recent_activity(
    days: int | None = None,
    limit: int = 8,
    offset: int = 0
):

    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    if days is None:
        date_filter = ""
        params = ()

    elif days == 1:
        date_filter = """
            AND e.created_at >= CURRENT_DATE
        """
        params = ()

    else:
        date_filter = """
            AND e.created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
        """
        params = (days,)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    e.event_type,
                    e.event_data,
                    e.created_at,
                    e.lead_id,
                    l.name,
                    l.company,
                    l.email
                FROM lead_events e
                JOIN leads l
                    ON l.lead_id = e.lead_id
                WHERE 1 = 1
                {date_filter}
                ORDER BY e.created_at DESC
                LIMIT %s
                OFFSET %s
                """,
                params + (limit + 1, offset)
            )

            rows = cursor.fetchall()

            has_more = len(rows) > limit
            rows = rows[:limit]

            return {
                "items": [
                    {
                        "event_type": row[0],
                        "event_data": row[1],
                        "created_at": row[2].isoformat(),
                        "lead_id": row[3],
                        "name": row[4],
                        "company": row[5],
                        "email": row[6]
                    }
                    for row in rows
                ],
                "limit": limit,
                "offset": offset,
                "has_more": has_more
            }
@app.get("/dashboard/communications/{lead_id}")
def get_communications(lead_id: str):

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                """
                SELECT
                    l.lead_id,
                    l.name,
                    l.company,
                    l.email,
                    l.message,
                    l.problem
                FROM leads l
                WHERE l.lead_id = %s
                """,
                (lead_id,)
            )

            lead = cursor.fetchone()

            if lead is None:
                raise HTTPException(
                    status_code=404,
                    detail="Lead not found"
                )

            cursor.execute(
                """
                SELECT
                    d.version,
                    d.source,
                    d.subject,
                    d.body,
                    d.status,
                    d.created_at
                FROM lead_drafts d
                WHERE d.lead_id = %s
                ORDER BY d.version ASC, d.created_at ASC
                """,
                (lead_id,)
            )

            drafts = cursor.fetchall()

    return {
        "lead": {
            "lead_id": lead[0],
            "name": lead[1],
            "company": lead[2],
            "email": lead[3],
            "message": lead[4],
            "problem": lead[5]
        },
        "drafts": [
            {
                "version": row[0],
                "source": row[1],
                "subject": row[2],
                "body": row[3],
                "status": row[4],
                "created_at": row[5].isoformat()
            }
            for row in drafts
        ]
    }

@app.get("/dashboard/performance")
def get_performance(days: int | None = None):

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            if days is None:
                cursor.execute(
                    """
                    SELECT
                        ROUND(
                            AVG(
                                EXTRACT(
                                    EPOCH FROM (
                                        e.created_at - l.created_at
                                    )
                                ) / 60
                            ),
                            1
                        )
                    FROM leads l
                    JOIN lead_events e
                        ON e.lead_id = l.lead_id
                    WHERE e.event_type = 'EMAIL_SENT'
                    """
                )

            elif days == 1:
                cursor.execute(
                    """
                    SELECT
                        ROUND(
                            AVG(
                                EXTRACT(
                                    EPOCH FROM (
                                        e.created_at - l.created_at
                                    )
                                ) / 60
                            ),
                            1
                        )
                    FROM leads l
                    JOIN lead_events e
                        ON e.lead_id = l.lead_id
                    WHERE e.event_type = 'EMAIL_SENT'
                      AND l.created_at >= CURRENT_DATE
                    """
                )

            else:
                cursor.execute(
                    """
                    SELECT
                        ROUND(
                            AVG(
                                EXTRACT(
                                    EPOCH FROM (
                                        e.created_at - l.created_at
                                    )
                                ) / 60
                            ),
                            1
                        )
                    FROM leads l
                    JOIN lead_events e
                        ON e.lead_id = l.lead_id
                    WHERE e.event_type = 'EMAIL_SENT'
                      AND l.created_at >= CURRENT_DATE
                            - (%s * INTERVAL '1 day')
                    """,
                    (days,)
                )

            row = cursor.fetchone()

            return {
                "average_processing_time_minutes": (
                    float(row[0])
                    if row[0] is not None
                    else None
                )
            }


@app.get("/dashboard/errors")
def get_errors(days: int | None = None):

    lead_filter, params = get_date_filter(days)

    with get_db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                f"""
                SELECT
                    COUNT(*) FILTER (
                        WHERE e.event_type = 'RAG_FAILED'
                    ) AS rag_errors,

                    COUNT(*) FILTER (
                        WHERE e.event_type = 'DRAFT_GENERATION_FAILED'
                    ) AS draft_generation_errors,

                    COUNT(*) FILTER (
                        WHERE e.event_type = 'EMAIL_SEND_FAILED'
                    ) AS email_send_errors

                FROM lead_events e
                JOIN leads l
                    ON l.lead_id = e.lead_id

                WHERE 1 = 1
                {lead_filter.replace("created_at", "l.created_at")}
                """,
                params 
            )

            row = cursor.fetchone()

            return {
                "rag_errors": row[0],
                "draft_generation_errors": row[1],
                "email_send_errors": row[2]
            }
