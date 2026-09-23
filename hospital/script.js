// Scroll to hospital search section

function scrollToSearch() {

    document.getElementById("search").scrollIntoView({
        behavior: "smooth"
    });

}


// Find hospitals

function findHospitals() {

    // Get values from input boxes

    const disease =
        document.getElementById("disease").value.trim();

    const location =
        document.getElementById("location").value.trim();

    const budget =
        document.getElementById("budget").value;


    const status =
        document.getElementById("status");

    const hospitalList =
        document.getElementById("hospital-list");


    // Clear previous results

    hospitalList.innerHTML = "";


    // Check whether user entered all information

    if (disease === "" || location === "" || budget === "") {

        status.innerText =
            "Please enter disease, location and budget.";

        return;
    }


    // Convert budget to number

    const budgetNumber = Number(budget);


    // Example hospital data
    // Later this will come from your Flask backend/API

    const hospitals = [

        {
            name: "City Care Hospital",
            city: location,
            distance: "12 km",
            treatment: disease,
            cost: 35000
        },

        {
            name: "Aarogya Multispeciality Hospital",
            city: location,
            distance: "25 km",
            treatment: disease,
            cost: 45000
        },

        {
            name: "National Healthcare Centre",
            city: location,
            distance: "40 km",
            treatment: disease,
            cost: 30000
        }

    ];


    // Filter hospitals according to budget

    const suitableHospitals =
        hospitals.filter(function(hospital) {

            return hospital.cost <= budgetNumber;

        });


    // No hospitals found

    if (suitableHospitals.length === 0) {

        status.innerText =
            "No hospitals found under your selected budget.";

        return;
    }


    // Display number of hospitals

    status.innerText =
        suitableHospitals.length +
        " suitable hospital(s) found.";


    // Display hospitals

    suitableHospitals.forEach(function(hospital) {

        const hospitalDiv =
            document.createElement("div");

        hospitalDiv.className = "hospital";


        hospitalDiv.innerHTML = `

            <h3>${hospital.name}</h3>

            <p>
                <strong>Location:</strong>
                ${hospital.city}
            </p>

            <p>
                <strong>Distance:</strong>
                ${hospital.distance}
            </p>

            <p>
                <strong>Treatment:</strong>
                ${hospital.treatment}
            </p>

            <p>
                <strong>Estimated Cost:</strong>
                ₹${hospital.cost.toLocaleString("en-IN")}
            </p>

        `;


        hospitalList.appendChild(hospitalDiv);

    });

}


// Health Assistant

function openAssistant() {

    alert(
        "Health Assistant will be connected to your chatbot/backend later."
    );

}