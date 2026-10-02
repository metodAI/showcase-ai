const API_URL = "http://localhost:8000";

const EVENTS_PER_PAGE = 8;

const SEARCH_LIMIT = 50;

const SEARCH_DEBOUNCE_MS = 300;

let eventsOffset = 0;
let hasMoreEvents = true;

let currentCommunication = null;
let currentDraftIndex = 0;

let loadedEvents = [];

let searchQuery = "";
let searchTimer = null;

const eventsList = document.getElementById("events-list");
const showMoreButton = document.getElementById("events-show-more");
const communicationContent = document.getElementById(
    "communication-content"
);

const searchInput = document.getElementById("lead-search");


function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDateTime(value) {

    const date = new Date(value);

    return date.toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function getEventTitle(eventType) {

    const labels = {

        LEAD_RECEIVED: "Lead received",

        AI_ANALYZED: "AI analysis completed",

        LEAD_SCORED: "Lead scored",

        HUMAN_APPROVED: "Lead approved",

        HUMAN_REJECTED: "Lead rejected",

        DRAFT_CREATED: "Email draft created",

        DRAFT_EDITED: "Email draft edited",

        DRAFT_APPROVED: "Email draft approved",

        DRAFT_REJECTED: "Email draft rejected",

        EMAIL_SENT: "Email sent",

        EMAIL_SEND_FAILED: "Email sending failed",

        DRAFT_GENERATION_FAILED:
            "Draft generation failed",

        DRAFT_SAVE_FAILED:
            "Draft save failed",

        EMAIL_STATUS_UPDATE_FAILED:
            "Email status update failed",

        RAG_FAILED:
            "Knowledge search failed"
    };

    return labels[eventType] || eventType;
}


function getEventDetail(item) {

    const eventData = item.event_data || {};

    switch (item.event_type) {

        case "LEAD_SCORED":
            return `Score: ${escapeHtml(eventData.score ?? "—")}`;

        case "EMAIL_SENT":
            return `Recipient: ${escapeHtml(
                eventData.recipient ??
                item.email ??
                "—"
            )}`;

        case "DRAFT_CREATED":
            return `Version ${escapeHtml(
                eventData.version ?? "—"
            )}`;

        case "DRAFT_EDITED":
            return "Draft version updated";

        case "DRAFT_REJECTED":
            return "Draft rejected";

        case "DRAFT_APPROVED":
            return "Draft approved";

        case "HUMAN_APPROVED":
            return "Human review approved";

        case "HUMAN_REJECTED":
            return "Human review rejected";

        default:
            return "";
    }
}


function createEventElement(item) {

    const element = document.createElement("div");

    element.className = "activity-event";

    element.dataset.leadId = item.lead_id;

    element.innerHTML = `

        <div class="activity-event-dot"></div>

        <div class="activity-event-content">

            <div class="activity-event-title">
                ${escapeHtml(
                    getEventTitle(item.event_type)
                )}
            </div>

            <div class="activity-event-detail">
                ${getEventDetail(item)}
            </div>

            <div class="activity-event-company">
                ${escapeHtml(
                    item.company ||
                    item.name ||
                    "Unknown lead"
                )}
            </div>

            <div class="activity-event-time">
                ${formatDateTime(item.created_at)}
            </div>

        </div>
    `;


    element.addEventListener("click", () => {

        document
            .querySelectorAll(".activity-event.active")
            .forEach(event => {
                event.classList.remove("active");
            });

        element.classList.add("active");

        loadCommunication(item.lead_id);
    });


    return element;
}


function renderActivitySummary() {

    const container =
        document.getElementById("activity-summary");

    if (!container) {
        return;
    }

    const countOf = eventType =>
        loadedEvents.filter(
            item => item.event_type === eventType
        ).length;

    let lastActivity = null;

    loadedEvents.forEach(item => {

        if (
            !lastActivity ||
            new Date(item.created_at) >
                new Date(lastActivity.created_at)
        ) {
            lastActivity = item;
        }
    });

    const rows = [
        {
            label: "Activities loaded",
            value: loadedEvents.length
        },
        {
            label: "Emails sent",
            value: countOf("EMAIL_SENT")
        },
        {
            label: "Drafts created",
            value: countOf("DRAFT_CREATED")
        },
        {
            label: "Leads scored",
            value: countOf("LEAD_SCORED")
        },
        {
            label: "Last activity",
            value: lastActivity
                ? formatDateTime(lastActivity.created_at)
                : "—"
        }
    ];


    container.innerHTML = rows.map(row => `
        <div class="reliability-item">

            <span>
                ${escapeHtml(row.label)}
            </span>

            <strong>
                ${escapeHtml(row.value)}
            </strong>

        </div>
    `).join("");
}


function matchesSearch(item) {

    const fields = [
        item.email,
        item.name,
        item.company,
        item.lead_id
    ];

    return fields.some(
        value =>
            value &&
            String(value).toLowerCase().includes(searchQuery)
    );
}


function renderSearchResults(items) {

    eventsList.innerHTML = "";

    if (items.length === 0) {

        eventsList.innerHTML = `
            <div class="activity-empty">
                No matching leads.
            </div>
        `;

        return;
    }

    items.forEach(item => {
        eventsList.appendChild(
            createEventElement(item)
        );
    });

    const firstEvent =
        eventsList.querySelector(".activity-event");

    if (firstEvent) {
        firstEvent.click();
    }
}


async function searchEvents() {

    const query = searchQuery;

    showMoreButton.disabled = true;

    try {

        const response = await fetch(
            `${API_URL}/dashboard/recent-activity` +
            `?limit=${SEARCH_LIMIT}`
        );

        if (!response.ok) {
            throw new Error(
                "Failed to search activity"
            );
        }

        const data = await response.json();

        if (query !== searchQuery) {
            return;
        }

        renderSearchResults(
            data.items.filter(matchesSearch)
        );

    } catch (error) {

        console.error(error);

        eventsList.innerHTML = `
            <div class="activity-empty">
                Unable to search activity.
            </div>
        `;

    } finally {

        showMoreButton.disabled = false;
        showMoreButton.style.display = "none";
    }
}


async function loadEvents(reset = false) {

    if (reset) {

        eventsOffset = 0;

        hasMoreEvents = true;

        loadedEvents = [];

        eventsList.innerHTML = "";
    }


    showMoreButton.disabled = true;


    try {

        const response = await fetch(
            `${API_URL}/dashboard/recent-activity` +
            `?limit=${EVENTS_PER_PAGE}` +
            `&offset=${eventsOffset}`
        );


        if (!response.ok) {
            throw new Error(
                "Failed to load events"
            );
        }


        const data = await response.json();


        if (
            reset &&
            data.items.length === 0
        ) {

            eventsList.innerHTML = `
                <div class="activity-empty">
                    No activity available.
                </div>
            `;

            showMoreButton.style.display = "none";

            renderActivitySummary();

            return;
        }


        data.items.forEach(item => {

            eventsList.appendChild(
                createEventElement(item)
            );

        });


        eventsOffset += data.items.length;

        hasMoreEvents = data.has_more;

        loadedEvents = loadedEvents.concat(data.items);

        renderActivitySummary();


        showMoreButton.style.display =
            hasMoreEvents
                ? "inline-block"
                : "none";


        if ((reset || !document.querySelector(".activity-event.active")) && data.items.length > 0) {
            const firstEvent = eventsList.querySelector(".activity-event");
            if (firstEvent) {
                firstEvent.click();
            }
        }

    } catch (error) {

        console.error(error);

        eventsList.innerHTML = `
            <div class="activity-empty">
                Unable to load activity.
            </div>
        `;

        showMoreButton.style.display = "none";

    } finally {

        showMoreButton.disabled = false;
    }
}


async function loadCommunication(leadId) {

    communicationContent.innerHTML = `
        <div class="communication-loading">
            Loading communication...
        </div>
    `;


    try {

        const response = await fetch(
            `${API_URL}/dashboard/communications/` +
            encodeURIComponent(leadId)
        );


        if (!response.ok) {

            throw new Error(
                "Failed to load communication"
            );
        }


        const data = await response.json();


        currentCommunication = data;

        currentDraftIndex = 0;


        renderCommunication(data);


    } catch (error) {

        console.error(error);

        communicationContent.innerHTML = `
            <div class="communication-error">
                Unable to load communication history.
            </div>
        `;
    }
}


function renderCommunication(data) {

    const lead = data.lead;

    const drafts = data.drafts || [];


    if (drafts.length === 0) {

        communicationContent.innerHTML = `

            <div class="communication-lead">

                <div class="communication-lead-name">
                    ${escapeHtml(
                        lead.name ||
                        "Unknown lead"
                    )}
                </div>

                <div class="communication-lead-company">
                    ${escapeHtml(
                        lead.company || "—"
                    )}
                </div>

                <div class="communication-lead-email">
                    ${escapeHtml(
                        lead.email || "—"
                    )}
                </div>

            </div>


            <div class="communication-section">

                <div class="communication-label">
                    Problem
                </div>

                <div class="communication-problem">
                    ${escapeHtml(
                        lead.problem ||
                        lead.message ||
                        "—"
                    )}
                </div>

            </div>


            <div class="communication-section">

                <div class="communication-label">
                    Response
                </div>

                <div class="communication-empty">
                    <div class="empty-icon">
                        ✉
                    </div>

                    <h3>
                        No response available
                    </h3>

                    <p>
                        This lead does not have an
                        email draft yet.
                    </p>
                </div>

            </div>
        `;

        return;
    }


    if (
        currentDraftIndex >= drafts.length
    ) {

        currentDraftIndex =
            drafts.length - 1;
    }


    const draft =
        drafts[currentDraftIndex];


    communicationContent.innerHTML = `

        <!-- LEAD -->

        <div class="communication-lead">

            <div class="communication-lead-name">
                ${escapeHtml(
                    lead.name ||
                    "Unknown lead"
                )}
            </div>

            <div class="communication-lead-company">
                ${escapeHtml(
                    lead.company || "—"
                )}
            </div>

            <div class="communication-lead-email">
                ${escapeHtml(
                    lead.email || "—"
                )}
            </div>

        </div>


        <!-- PROBLEM -->

        <div class="communication-section">

            <div class="communication-label">
                Problem
            </div>

            <div class="communication-problem">
                ${escapeHtml(
                    lead.problem ||
                    lead.message ||
                    "—"
                )}
            </div>

        </div>


        <!-- RESPONSE -->

        <div class="communication-section">

            <div class="communication-label">
                Response
            </div>


            <div class="draft-version-bar">

                ${drafts.map(
                    (item, index) => `

                        <button
                            type="button"
                            class="draft-version-button ${
                                index === currentDraftIndex
                                    ? "active"
                                    : ""
                            }"
                            data-draft-index="${index}"
                        >
                            v${escapeHtml(
                                item.version
                            )}
                            ·
                            ${escapeHtml(
                                item.source
                            )}
                        </button>
                    `
                ).join("")}

            </div>


            <div class="email-card">

                <div class="email-card-header">

                    <div class="email-subject">
                        ${escapeHtml(
                            draft.subject ||
                            "No subject"
                        )}
                    </div>

                    <div class="email-meta">

                        <span>
                            Version ${escapeHtml(
                                draft.version
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                draft.source
                            )}
                        </span>

                        <span>
                            ${formatDateTime(
                                draft.created_at
                            )}
                        </span>

                    </div>

                    <div class="communication-status">
                        ${escapeHtml(
                            draft.status ||
                            "DRAFT"
                        )}
                    </div>

                </div>


                <div class="email-body">
                    ${escapeHtml(
                        draft.body ||
                        "No response available."
                    )}
                </div>

            </div>

        </div>
    `;


    document
        .querySelectorAll(
            ".draft-version-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentDraftIndex =
                        Number(
                            button.dataset
                                .draftIndex
                        );

                    renderCommunication(
                        currentCommunication
                    );
                }
            );

        });
}


showMoreButton.addEventListener(
    "click",
    () => {
        loadEvents(false);
    }
);


if (searchInput) {

    searchInput.addEventListener("input", () => {

        searchQuery =
            searchInput.value.trim().toLowerCase();

        clearTimeout(searchTimer);

        if (!searchQuery) {
            loadEvents(true);

            return;
        }

        searchTimer = setTimeout(
            searchEvents,
            SEARCH_DEBOUNCE_MS
        );
    });
}


loadEvents(true);