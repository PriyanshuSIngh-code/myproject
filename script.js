
// ==========================================
// GLOBAL VARIABLES
// ==========================================

let map = null;
let userMarker = null;
let hospitalMarkers = [];


// ==========================================
// INITIALIZE MAP
// ==========================================

function initializeMap(
    lat = 20.5937,
    lon = 78.9629
) {

    map = L.map("map").setView(
        [lat, lon],
        5
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);
}


// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {
        initializeMap();
    }
);


// ==========================================
// FIND HOSPITALS
// ==========================================

function findHospitals() {

    const status =
        document.getElementById("locationStatus");

    if (!navigator.geolocation) {

        status.textContent =
            "Your browser does not support location services.";

        return;
    }

    status.textContent =
        "Requesting your location...";

    navigator.geolocation.getCurrentPosition(

        function (position) {

            const lat =
                position.coords.latitude;

            const lon =
                position.coords.longitude;

            status.textContent =
                "Location found. Searching nearby hospitals...";

            showUserLocation(lat, lon);

            getHospitals(lat, lon);
        },

        function (error) {

            console.error("Location error:", error);

            if (error.code === 1) {

                status.textContent =
                    "Location permission was denied. Please allow location access.";

            } else if (error.code === 2) {

                status.textContent =
                    "Your location could not be determined.";

            } else if (error.code === 3) {

                status.textContent =
                    "Location request timed out. Please try again.";

            } else {

                status.textContent =
                    "Unable to get your location.";
            }
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}


// ==========================================
// SHOW USER LOCATION
// ==========================================

function showUserLocation(lat, lon) {

    map.setView(
        [lat, lon],
        13
    );

    if (userMarker) {
        map.removeLayer(userMarker);
    }

    userMarker =
        L.marker([lat, lon])
            .addTo(map)
            .bindPopup("<b>You are here</b>")
            .openPopup();
}


// ==========================================
// GET HOSPITALS
// ==========================================

async function getHospitals(lat, lon) {

    const status =
        document.getElementById("locationStatus");

    try {

        const response =
            await fetch(
                `/api/hospitals?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=5000`
            );

        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.error || "Hospital search failed."
            );
        }

        displayHospitals(data.hospitals);

        status.textContent =
            `${data.hospitals.length} healthcare facilities found nearby.`;

    } catch (error) {

        console.error("Hospital error:", error);

        status.textContent =
            "Unable to load nearby hospitals. Please try again.";
    }
}


// ==========================================
// DISPLAY HOSPITALS
// ==========================================

function displayHospitals(hospitals) {

    const container =
        document.getElementById("hospitalList");

    container.innerHTML = "";

    hospitalMarkers.forEach(function (marker) {

        map.removeLayer(marker);

    });

    hospitalMarkers = [];


    if (!hospitals || hospitals.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="big-icon">🏥</div>
                <h3>No hospitals found</h3>
                <p>Try searching from a different location.</p>
            </div>
        `;

        return;
    }


    hospitals.forEach(function (hospital) {

        const marker =
            L.marker([
                hospital.lat,
                hospital.lon
            ])
            .addTo(map)
            .bindPopup(`
                <b>${escapeHTML(hospital.name)}</b>
                <br>
                ${escapeHTML(hospital.address)}
            `);

        hospitalMarkers.push(marker);


        const card =
            document.createElement("div");

        card.className =
            "hospital-card";


        let phoneHTML = "";

        if (
            hospital.phone &&
            hospital.phone !== "Not available"
        ) {

            phoneHTML = `
                <p>
                    📞 ${escapeHTML(hospital.phone)}
                </p>
            `;
        }


        let websiteHTML = "";

        if (hospital.website) {

            const safeWebsite =
                normalizeWebsite(hospital.website);

            if (safeWebsite) {

                websiteHTML = `
                    <p>
                        <a
                            href="${safeWebsite}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            🌐 Website
                        </a>
                    </p>
                `;
            }
        }


        card.innerHTML = `
            <h3>
                🏥 ${escapeHTML(hospital.name)}
            </h3>

            <p>
                📍 ${escapeHTML(hospital.address)}
            </p>

            ${phoneHTML}

            ${websiteHTML}
        `;

        container.appendChild(card);
    });
}


// ==========================================
// CHATBOT
// ==========================================

async function sendMessage() {

    const input =
        document.getElementById("chatInput");

    const message =
        input.value.trim();

    if (!message) {
        return;
    }

    addMessage(
        message,
        "user"
    );

    input.value = "";

    try {

        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message: message
                    })
                }
            );

        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }

        const data =
            await response.json();

        addMessage(
            data.reply,
            "bot"
        );

    } catch (error) {

        console.error(
            "Chat error:",
            error
        );

        addMessage(
            "Sorry, something went wrong. Please try again.",
            "bot"
        );
    }
}


// ==========================================
// ADD CHAT MESSAGE
// ==========================================

function addMessage(text, sender) {

    const container =
        document.getElementById(
            "chatMessages"
        );

    const message =
        document.createElement("div");

    message.className =
        `message ${sender}`;

    message.textContent =
        text;

    container.appendChild(message);

    container.scrollTop =
        container.scrollHeight;
}


// ==========================================
// ENTER KEY
// ==========================================

function handleEnter(event) {

    if (event.key === "Enter") {
        sendMessage();
    }
}


// ==========================================
// SCROLL TO CHAT
// ==========================================

function scrollToChat() {

    const chat =
        document.getElementById("chat");

    if (chat) {

        chat.scrollIntoView({
            behavior: "smooth"
        });
    }
}


// ==========================================
// EMERGENCY
// ==========================================

function showEmergencyMessage() {

    alert(
        "If this is a medical emergency, contact your local emergency service or seek immediate professional medical assistance."
    );
}


// ==========================================
// FIRST AID / HEALTH GUIDANCE
// ==========================================

function analyzeSymptoms() {

    const age =
        document.getElementById("age").value.trim();

    const gender =
        document.getElementById("gender").value;

    const issue =
        document.getElementById("issue").value.trim();

    const symptoms = [
        ...document.querySelectorAll(
            ".symptom input:checked"
        )
    ].map(function (input) {

        return input.value;

    });

    const guidance =
        document.getElementById("guidance");


    if (
        !age ||
        !gender ||
        !issue ||
        symptoms.length === 0
    ) {

        guidance.style.display = "block";

        guidance.className =
            "guidance";

        guidance.innerHTML = `
            <h3>⚠️ Please complete the information</h3>

            <p>
                Enter your age, select your gender,
                describe your main issue, and select
                at least one symptom.
            </p>
        `;

        return;
    }


    if (symptoms.includes("breathing")) {

        guidance.style.display = "block";

        guidance.className =
            "guidance emergency-guidance";

        guidance.innerHTML = `
            <h3>🚨 Seek medical help promptly</h3>

            <p>
                Breathing difficulty can require
                urgent medical assessment.
            </p>

            <p>
                If the problem is severe, sudden,
                or getting worse, seek immediate
                professional medical assistance.
            </p>

            <p>
                This website cannot diagnose or
                treat medical conditions.
            </p>
        `;

        return;
    }


    let advice = "";


    if (
        symptoms.includes("fever") ||
        symptoms.includes("cold") ||
        symptoms.includes("cough") ||
        symptoms.includes("throat")
    ) {

        advice = `
            These symptoms can occur with several
            different illnesses. Rest, maintain
            adequate fluid intake, and monitor
            how you feel. If symptoms become severe,
            persist, or worsen, speak with a
            healthcare professional.
        `;

    } else if (
        symptoms.includes("vomiting") ||
        symptoms.includes("diarrhea") ||
        symptoms.includes("stomach")
    ) {

        advice = `
            Stomach symptoms can have different
            causes. Focus on rest and maintaining
            hydration. If symptoms become severe,
            you cannot keep fluids down, or you are
            concerned about dehydration, seek
            medical advice.
        `;

    } else if (
        symptoms.includes("headache") ||
        symptoms.includes("dizziness") ||
        symptoms.includes("bodypain")
    ) {

        advice = `
            Rest and maintain adequate hydration
            while monitoring your symptoms. If
            symptoms are severe, sudden, persistent,
            or getting worse, seek professional
            medical advice.
        `;

    } else if (
        symptoms.includes("rash")
    ) {

        advice = `
            Skin rashes can have many different
            causes. Avoid irritating the affected
            area and monitor changes. If the rash
            becomes severe, spreads quickly, or
            occurs with other concerning symptoms,
            seek medical advice.
        `;

    } else {

        advice = `
            Monitor your symptoms and take care
            of basic needs such as rest and
            hydration. If your symptoms persist,
            worsen, or cause concern, contact a
            healthcare professional.
        `;
    }


    guidance.style.display =
        "block";

    guidance.className =
        "guidance";

    guidance.innerHTML = `
        <h3>🩺 General Health Guidance</h3>

        <p>
            <strong>Age:</strong>
            ${escapeHTML(age)}
        </p>

        <p>
            <strong>Gender:</strong>
            ${escapeHTML(gender)}
        </p>

        <p>
            <strong>Main issue:</strong>
            ${escapeHTML(issue)}
        </p>

        <p>
            <strong>Selected symptoms:</strong>
            ${symptoms.map(function (symptom) {

                return escapeHTML(
                    formatSymptom(symptom)
                );

            }).join(", ")}
        </p>

        <p>${advice}</p>

        <p>
            <strong>Important:</strong>
            This tool provides general health
            information and cannot diagnose a
            medical condition. For personalized
            medical advice, consult a qualified
            healthcare professional.
        </p>
    `;
}


// ==========================================
// FORMAT SYMPTOMS
// ==========================================

function formatSymptom(symptom) {

    const names = {

        cough: "Cough",
        fever: "Fever",
        cold: "Cold",
        headache: "Headache",
        stomach: "Stomach problem",
        vomiting: "Vomiting",
        throat: "Sore throat",
        diarrhea: "Diarrhea",
        bodypain: "Body pain",
        dizziness: "Dizziness",
        breathing: "Breathing difficulty",
        rash: "Skin rash"
    };

    return (
        names[symptom] ||
        symptom
    );
}


// ==========================================
// HTML SAFETY
// ==========================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// WEBSITE URL
// ==========================================

function normalizeWebsite(website) {

    if (!website) {
        return "";
    }

    let url =
        website.trim();

    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {

        url =
            "https://" + url;
    }

    try {

        const parsed =
            new URL(url);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {

            return "";
        }

        return escapeHTML(
            parsed.href
        );

    } catch {

        return "";
    }
}
