const API_URL = "http://localhost:8000";

const RECENT_ACTIVITY_LIMIT = 4;

let selectedDays = 30;

let leadActivityChart = null;
let pipelineChart = null;
let classificationChart = null;


/* =========================
   CHART CONFIGURATION
========================= */

Chart.defaults.color = "#8b96a5";
Chart.defaults.font.family =
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

Chart.defaults.borderColor = "#242c36";


/* =========================
   HELPER
========================= */

function getQueryString() {
    return selectedDays === null
        ? ""
        : `?days=${selectedDays}`;
}


function getRecentActivityQueryString() {
    const query = getQueryString();

    return query
        ? `${query}&limit=${RECENT_ACTIVITY_LIMIT}`
        : `?limit=${RECENT_ACTIVITY_LIMIT}`;
}


/* =========================
   LOAD KPI / PERFORMANCE / ERRORS
========================= */

async function loadDashboardMetrics() {

    const query = getQueryString();

    const kpiResponse = await fetch(
        `${API_URL}/dashboard/kpis${query}`
    );

    if (!kpiResponse.ok) {
        throw new Error(
            "Nie udało się pobrać danych KPI."
        );
    }

    const kpiData = await kpiResponse.json();

    document.getElementById("leads-received").textContent =
        kpiData.leads_received;

    document.getElementById("qualified-leads").textContent =
        kpiData.qualified_leads;

    document.getElementById("review-required").textContent =
        kpiData.review_required;

    document.getElementById("emails-sent").textContent =
        kpiData.emails_sent;

    document.getElementById("average-lead-score").textContent =
        kpiData.average_lead_score ?? "—";

    document.getElementById("automation-average-score").textContent =
        kpiData.average_lead_score ?? "—";

    const performanceResponse = await fetch(
        `${API_URL}/dashboard/performance${query}`
    );

    if (!performanceResponse.ok) {
        throw new Error(
            "Nie udało się pobrać danych wydajności."
        );
    }

    const performanceData =
        await performanceResponse.json();

    const processingTime =
        performanceData.average_processing_time_minutes;

    document.getElementById("processing-time").textContent =
        processingTime !== null
            ? `${processingTime} min`
            : "—";


    const errorsResponse = await fetch(
        `${API_URL}/dashboard/errors${query}`
    );

    if (!errorsResponse.ok) {
        throw new Error(
            "Nie udało się pobrać danych o błędach."
        );
    }

    const errorsData =
        await errorsResponse.json();

    document.getElementById("rag-errors").textContent =
        errorsData.rag_errors;

    document.getElementById("draft-generation-errors").textContent =
        errorsData.draft_generation_errors;

    document.getElementById("email-send-errors").textContent =
        errorsData.email_send_errors;
}


/* =========================
   LEAD ACTIVITY CHART
========================= */

async function loadLeadActivityChart() {

    const query = getQueryString();

    const response = await fetch(
        `${API_URL}/dashboard/leads-over-time${query}`
    );

    if (!response.ok) {
        throw new Error(
            "Nie udało się pobrać danych Lead Activity."
        );
    }

    const data = await response.json();

    const labels = data.map(item => item.date);
    const values = data.map(item => item.count);

    const canvas =
        document.getElementById("lead-activity-chart");

    if (leadActivityChart) {
        leadActivityChart.destroy();
    }

    leadActivityChart = new Chart(canvas, {

        type: "line",

        data: {
            labels: labels,

            datasets: [
                {
                    label: "Leads",
                    data: values,

                    borderColor: "#7c8cff",
                    backgroundColor: "rgba(124, 140, 255, 0.10)",

                    borderWidth: 2,

                    fill: true,

                    tension: 0.35,

                    pointRadius: 3,
                    pointHoverRadius: 5,

                    pointBackgroundColor: "#7c8cff",
                    pointBorderColor: "#11161d",
                    pointBorderWidth: 2
                }
            ]
        },

        options: {

            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {
                    backgroundColor: "#171d25",
                    borderColor: "#242c36",
                    borderWidth: 1,

                    titleColor: "#f2f5f8",
                    bodyColor: "#f2f5f8",

                    padding: 10
                }
            },

            scales: {

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#687381",
                        maxRotation: 0
                    }
                },

                y: {
                    beginAtZero: true,

                    ticks: {
                        precision: 0,
                        color: "#687381"
                    },

                    grid: {
                        color: "rgba(36, 44, 54, 0.7)"
                    }
                }
            }
        }
    });
}


/* =========================
   LEAD PIPELINE CHART
========================= */

async function loadPipelineChart() {

    const query = getQueryString();

    const response = await fetch(
        `${API_URL}/dashboard/statuses${query}`
    );

    if (!response.ok) {
        throw new Error(
            "Nie udało się pobrać danych Lead Pipeline."
        );
    }

    const data = await response.json();

    const labels = data.map(item => item.status);
    const values = data.map(item => item.count);

    const canvas =
        document.getElementById("pipeline-chart");

    if (pipelineChart) {
        pipelineChart.destroy();
    }

    pipelineChart = new Chart(canvas, {

        type: "bar",

        data: {
            labels: labels,

            datasets: [
                {
                    label: "Leads",
                    data: values,

                    backgroundColor: "#7c8cff",

                    borderRadius: 5,

                    borderSkipped: false
                }
            ]
        },

        options: {

            responsive: true,
            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {
                    backgroundColor: "#171d25",
                    borderColor: "#242c36",
                    borderWidth: 1,

                    titleColor: "#f2f5f8",
                    bodyColor: "#f2f5f8",

                    padding: 10
                }
            },

            scales: {

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#687381",

                        maxRotation: 45,
                        minRotation: 0
                    }
                },

                y: {
                    beginAtZero: true,

                    ticks: {
                        precision: 0,
                        color: "#687381"
                    },

                    grid: {
                        color: "rgba(36, 44, 54, 0.7)"
                    }
                }
            }
        }
    });
}


/* =========================
   CLASSIFICATION CHART
========================= */

async function loadClassificationChart() {

    const query = getQueryString();

    const response = await fetch(
        `${API_URL}/dashboard/classifications${query}`
    );

    if (!response.ok) {
        throw new Error(
            "Nie udało się pobrać danych Classification."
        );
    }

    const data = await response.json();

    const labels = data.map(
        item => item.classification
    );

    const values = data.map(
        item => item.count
    );

    const canvas =
        document.getElementById("classification-chart");

    if (classificationChart) {
        classificationChart.destroy();
    }

    classificationChart = new Chart(canvas, {

        type: "doughnut",

        data: {
            labels: labels,

            datasets: [
                {
                    data: values,

                    backgroundColor: [
                        "#7c8cff",
                        "#f0b35a",
                        "#586473"
                    ],

                    borderColor: "#11161d",
                    borderWidth: 3,

                    hoverOffset: 5
                }
            ]
        },

        options: {

            responsive: true,
            maintainAspectRatio: false,

            cutout: "68%",

            plugins: {

                legend: {
                    position: "bottom",

                    labels: {
                        color: "#8b96a5",

                        padding: 18,

                        usePointStyle: true,
                        pointStyle: "circle",

                        font: {
                            size: 11
                        }
                    }
                },

                tooltip: {
                    backgroundColor: "#171d25",
                    borderColor: "#242c36",
                    borderWidth: 1,

                    titleColor: "#f2f5f8",
                    bodyColor: "#f2f5f8",

                    padding: 10
                }
            }
        }
    });
}


/* =========================
   LOAD ALL CHARTS
========================= */
async function loadAutomationEfficiency() {
    try {
        const response = await fetch(
            `${API_URL}/dashboard/automation-efficiency${getQueryString()}`
        );

        const data = await response.json();

        const metrics = [
            {
                value: data.automation_rate,
                valueId: "automation-rate",
                barId: "automation-rate-bar"
            },
            {
                value: data.qualification_rate,
                valueId: "qualification-rate",
                barId: "qualification-rate-bar"
            },
            {
                value: data.email_completion_rate,
                valueId: "email-completion-rate",
                barId: "email-completion-rate-bar"
            }
        ];

        metrics.forEach(metric => {
            const valueElement = document.getElementById(metric.valueId);
            const barElement = document.getElementById(metric.barId);

            if (valueElement) {
                valueElement.textContent = `${metric.value}%`;
            }

            if (barElement) {
                barElement.style.width = `${metric.value}%`;
            }
        });

    } catch (error) {
        console.error("Automation efficiency error:", error);
    }
}

async function loadCharts() {

    await Promise.all([
        loadLeadActivityChart(),
        loadPipelineChart(),
        loadClassificationChart()
    ]);
}

function calculateROI() {

    const monthlyLeads =
        Number(document.getElementById("roi-monthly-leads").value) || 0;

    const minutesPerLead =
        Number(document.getElementById("roi-minutes-per-lead").value) || 0;

    const hourlyLaborCost =
        Number(document.getElementById("roi-hourly-cost").value) || 0;

    const qualificationRate =
        Number(document.getElementById("roi-qualification-rate").value) || 0;

    const leadValue =
        Number(document.getElementById("roi-lead-value").value) || 0;


    const manualProcessingCost =
        monthlyLeads *
        (minutesPerLead / 60) *
        hourlyLaborCost;


    const timeSaved =
        monthlyLeads *
        (minutesPerLead / 60);


    const monthlySavings =
        manualProcessingCost;


    const annualSavings =
        monthlySavings * 12;


    const potentialLeadValue =
        monthlyLeads *
        (qualificationRate / 100) *
        leadValue;


    const currency = new Intl.NumberFormat(
        "pl-PL",
        {
            style: "currency",
            currency: "PLN",
            maximumFractionDigits: 0
        }
    );


    document.getElementById("roi-manual-cost").textContent =
        currency.format(manualProcessingCost);

    document.getElementById("roi-time-saved").textContent =
        `${timeSaved.toFixed(1)} h`;

    document.getElementById("roi-monthly-savings").textContent =
        currency.format(monthlySavings);

    document.getElementById("roi-annual-savings").textContent =
        currency.format(annualSavings);

    document.getElementById("roi-lead-value-result").textContent =
        currency.format(potentialLeadValue);
}


    document.getElementById("roi-calculate")
    .addEventListener("click", calculateROI);


/* =========================
   LOAD DASHBOARD
========================= */

async function loadDashboard() {

    try {

        await loadDashboardMetrics();

        await loadCharts();

        await loadAutomationEfficiency();

        await loadRecentActivity();

        console.log(
            `Dashboard loaded: ${
                selectedDays === null
                    ? "all time"
                    : `${selectedDays} days`
            }`
        );

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );
    }
}


/* =========================
   TIME FILTER
========================= */

const filterButton =
    document.getElementById("time-filter-button");

const filterMenu =
    document.getElementById("time-filter-menu");

const selectedPeriod =
    document.getElementById("selected-period");

const filterOptions =
    filterMenu.querySelectorAll("button");


filterButton.addEventListener("click", () => {

    filterMenu.classList.toggle("open");

});


filterOptions.forEach(option => {

    option.addEventListener(
        "click",
        async () => {

            filterOptions.forEach(item => {
                item.classList.remove("selected");
            });

            option.classList.add("selected");

            selectedPeriod.textContent =
                option.textContent.trim();


            const period =
                option.dataset.period;


            if (period === "today") {

                selectedDays = 1;

            } else if (period === "7") {

                selectedDays = 7;

            } else if (period === "30") {

                selectedDays = 30;

            } else if (period === "90") {

                selectedDays = 90;

            } else if (period === "all") {

                selectedDays = null;
            }


            filterMenu.classList.remove("open");

            await loadDashboard();

        }
    );

});


/* =========================
   CLOSE FILTER
========================= */

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(".time-filter")
        ) {

            filterMenu.classList.remove("open");

        }
    }
);


/* =========================
   INITIAL LOAD
========================= */

loadDashboard();

async function loadRecentActivity() {

    const container =
        document.getElementById("recent-activity-list");

    if (!container) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/dashboard/recent-activity${getRecentActivityQueryString()}`
        );

        if (!response.ok) {
            throw new Error(
                "Nie udało się pobrać aktywności."
            );
        }

        const data =
            await response.json();

        const activities = data.items || [];


        if (!activities.length) {

            container.innerHTML = `
                <div class="recent-activity-empty">
                    No recent activity
                </div>
            `;

            return;
        }


        const eventLabels = {

            EMAIL_SENT: "Email sent",

            DRAFT_APPROVED: "Draft approved",

            DRAFT_REJECTED: "Draft rejected",

            DRAFT_CREATED: "Draft created",

            DRAFT_EDITED: "Draft edited",

            HUMAN_APPROVED: "Lead approved",

            HUMAN_REJECTED: "Lead rejected",

            LEAD_SCORED: "Lead scored",

            AI_ANALYZED: "Lead analyzed",

            LEAD_RECEIVED: "Lead received"

        };


        container.innerHTML =
            activities.map(activity => {

                const title =
                    eventLabels[activity.event_type]
                    || activity.event_type;


                const company =
                    activity.company
                    || activity.name
                    || "Unknown lead";


                const date =
                    new Date(activity.created_at);


                const time =
                    date.toLocaleTimeString(
                        "pl-PL",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );


                let detail = "";


                if (activity.event_type === "EMAIL_SENT") {

                    detail =
                        activity.event_data?.subject
                        || "Email delivered";

                } else if (
                    activity.event_type === "LEAD_SCORED"
                ) {

                    detail =
                        `Score: ${activity.event_data?.score ?? "—"}`;

                } else if (
                    activity.event_type === "HUMAN_APPROVED"
                ) {

                    detail =
                        "Lead moved to approved";

                } else if (
                    activity.event_type === "DRAFT_CREATED"
                ) {

                    detail =
                        `AI draft · Version ${activity.event_data?.version ?? "—"}`;

                } else if (
                    activity.event_type === "DRAFT_REJECTED"
                ) {

                    detail =
                        "Draft rejected";

                } else if (
                    activity.event_type === "DRAFT_APPROVED"
                ) {

                    detail =
                        "Draft approved for sending";

                } else if (
                    activity.event_type === "AI_ANALYZED"
                ) {

                    detail =
                        `${activity.event_data?.service ?? "Lead analyzed"}`;

                } else {

                    detail =
                        "System activity";
                }


                return `
                    <div class="recent-activity-item">

                        <div class="recent-activity-dot"></div>

                        <div class="recent-activity-content">

                            <div class="recent-activity-title">
                                ${title}
                            </div>

                            <div class="recent-activity-detail">
                                ${detail}
                            </div>

                            <div class="recent-activity-company">
                                ${company}
                            </div>

                        </div>

                        <div class="recent-activity-time">
                            ${time}
                        </div>

                    </div>
                `;

            }).join("");


    } catch (error) {

        console.error(
            "Recent activity error:",
            error
        );

        container.innerHTML = `
            <div class="recent-activity-empty">
                Unable to load activity
            </div>
        `;
    }
}