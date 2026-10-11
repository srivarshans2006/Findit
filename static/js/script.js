
document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("searchInput");
    const searchForm = document.getElementById("searchForm");
    const typeFilter = document.getElementById("typeFilter");
    const itemColumns = [
        ...document.querySelectorAll(".item-column")
    ];
    const emptyState = document.getElementById("emptyState");

    // Search and filter items
    function filterItems() {
        const query = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const selectedType = typeFilter
            ? typeFilter.value
            : "All";

        let visibleCount = 0;

        itemColumns.forEach((column) => {
            const searchableText = column.dataset.search || "";
            const itemType = column.dataset.type;

            const matchesSearch = searchableText.includes(query);
            const matchesType =
                selectedType === "All" || itemType === selectedType;

            const visible = matchesSearch && matchesType;

            column.classList.toggle("d-none", !visible);

            if (visible) visibleCount++;
        });

        if (emptyState) {
            emptyState.classList.toggle("d-none", visibleCount !== 0);
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", filterItems);
    }

    if (searchForm) {
        searchForm.addEventListener("submit", function (event) {
            event.preventDefault();
            filterItems();
        });
    }

    if (typeFilter) {
        typeFilter.addEventListener("change", filterItems);
    }

    // Open the report modal
    window.openReport = function (type) {
        const reportType = document.getElementById("reportType");
        const title = document.getElementById("reportModalTitle");
        const modalElement = document.getElementById("reportModal");

        if (!reportType || !title || !modalElement) {
            console.error("Report modal elements are missing.");
            return;
        }

        reportType.value = type;
        title.textContent = `Report a ${type.toLowerCase()} item`;

        bootstrap.Modal.getOrCreateInstance(modalElement).show();
    };

    // Open the item details modal
    window.showItemDetails = function (
        name, type, category, location, description
    ) {
        const modalElement = document.getElementById("detailsModal");
        const body = document.getElementById("detailsBody");

        if (!modalElement || !body) {
            console.error("Details modal elements are missing.");
            return;
        }

        if (!window.bootstrap || !bootstrap.Modal) {
            console.error("Bootstrap JavaScript is not loaded.");
            return;
        }

        body.replaceChildren();

        const fields = [
            ["Item", name],
            ["Report type", type],
            ["Category", category],
            ["Location", location],
            ["Description", description]
        ];

        fields.forEach(([label, value]) => {
            const paragraph = document.createElement("p");
            const strong = document.createElement("strong");

            strong.textContent = `${label}: `;
            paragraph.appendChild(strong);
            paragraph.appendChild(
                document.createTextNode(value ?? "")
            );

            body.appendChild(paragraph);
        });

        bootstrap.Modal.getOrCreateInstance(modalElement).show();
    };


    document.querySelectorAll(".view-details-btn").forEach((button) => {
        button.addEventListener("click", () => {
            window.showItemDetails(
                button.dataset.name,
                button.dataset.type,
                button.dataset.category,
                button.dataset.location,
                button.dataset.description
            );
        });
    });


    // Let Flask handle report submission
    const reportForm = document.getElementById("reportForm");

    if (reportForm) {
        reportForm.addEventListener("submit", function (event) {
            if (!reportForm.reportValidity()) {
                event.preventDefault();
            }
        });
    }
});
