
document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("searchInput");
    const searchForm = document.getElementById("searchForm");
    const typeFilter = document.getElementById("typeFilter");
    const itemGrid = document.getElementById("itemGrid");
    const emptyState = document.getElementById("emptyState");

    const user = window.finditUser || {
        authenticated: false,
        id: null,
        loginUrl: "/login"
    };

    // Search and filter items currently displayed on the page.
    function filterItems() {
        const query = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const selectedType = typeFilter
            ? typeFilter.value
            : "All";

        // Query dynamically because cards are loaded from the API.
        const itemColumns = [
            ...document.querySelectorAll(".item-column")
        ];

        let visibleCount = 0;

        itemColumns.forEach(function (column) {
            const searchableText = column.dataset.search || "";
            const itemType = column.dataset.type;

            const matchesSearch = searchableText.includes(query);
            const matchesType =
                selectedType === "All" ||
                itemType === selectedType;

            const visible = matchesSearch && matchesType;

            column.classList.toggle("d-none", !visible);

            if (visible) {
                visibleCount++;
            }
        });

        if (emptyState) {
            emptyState.classList.toggle(
                "d-none",
                visibleCount !== 0
            );
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

    // Open the report modal.
    window.openReport = function (type) {
        const reportType = document.getElementById("reportType");
        const title = document.getElementById("reportModalTitle");
        const modalElement = document.getElementById("reportModal");

        if (!reportType || !title || !modalElement) {
            return;
        }

        reportType.value = type;
        title.textContent =
            `Report a ${type.toLowerCase()} item`;

        bootstrap.Modal
            .getOrCreateInstance(modalElement)
            .show();
    };

    // Display item details safely.
    window.showItemDetails = function (
        name,
        type,
        category,
        location,
        description
    ) {
        const modalElement = document.getElementById("detailsModal");
        const body = document.getElementById("detailsBody");

        if (!modalElement || !body) {
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

        fields.forEach(function ([label, value]) {
            const paragraph = document.createElement("p");
            const strong = document.createElement("strong");

            strong.textContent = `${label}: `;

            paragraph.appendChild(strong);
            paragraph.appendChild(
                document.createTextNode(value ?? "")
            );

            body.appendChild(paragraph);
        });

        bootstrap.Modal
            .getOrCreateInstance(modalElement)
            .show();
    };

    // Create an HTML element and safely insert text.
    function addTextElement(parent, tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        element.textContent = text ?? "";
        parent.appendChild(element);

        return element;
    }

    // Create a card for one item returned by /api/items.
    function createItemCard(item) {
        const column = document.createElement("div");

        column.className = "col-md-6 col-lg-3 item-column";
        column.dataset.type = item.type;
        column.dataset.search = [
            item.name,
            item.category,
            item.location,
            item.description
        ].join(" ").toLowerCase();

        const article = document.createElement("article");
        article.className = "item-card";

        const visualClasses = {
            "ID Cards": "visual-id",
            "Bags": "visual-bag",
            "Electronics": "visual-tech"
        };

        const symbols = {
            "ID Cards": "▤",
            "Bags": "▣",
            "Electronics": "◉"
        };

        const visual = document.createElement("div");

        visual.className =
            "item-visual " +
            (visualClasses[item.category] || "visual-other");

        addTextElement(
            visual,
            "span",
            "item-symbol",
            symbols[item.category] || "◇"
        );

        addTextElement(
            visual,
            "span",
            "status-badge " +
                (item.type === "Lost"
                    ? "status-lost"
                    : "status-found"),
            item.type
        );

        article.appendChild(visual);

        const content = document.createElement("div");
        content.className = "item-content";

        addTextElement(
            content, "span", "category-label", item.category
        );

        addTextElement(content, "h3", "", item.name);

        addTextElement(
            content, "p", "item-description", item.description
        );

        const meta = document.createElement("div");
        meta.className = "item-meta";

        addTextElement(
            meta, "span", "", "⌖ " + (item.location || "")
        );

        const date = item.created_at
            ? new Date(item.created_at).toLocaleDateString(
                "en-GB",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            )
            : "";

        addTextElement(meta, "span", "", date);
        content.appendChild(meta);

        // View Details button.
        const detailsButton = document.createElement("button");

        detailsButton.type = "button";
        detailsButton.className =
            "btn btn-outline-success w-100 mt-3 view-details-btn";
        detailsButton.textContent = "View details";

        detailsButton.addEventListener("click", function () {
            window.showItemDetails(
                item.name,
                item.type,
                item.category,
                item.location,
                item.description
            );
        });

        content.appendChild(detailsButton);

        // Claim functionality for found items.
        if (item.type === "Found" && item.status === "Open") {
            if (!user.authenticated) {
                const loginLink = document.createElement("a");

                loginLink.href = user.loginUrl;
                loginLink.className =
                    "btn btn-success w-100 mt-3";
                loginLink.textContent = "Log in to claim";

                content.appendChild(loginLink);
            } else if (
                String(user.id) === String(item.user_id)
            ) {
                addTextElement(
                    content,
                    "p",
                    "text-secondary small mt-3 mb-0",
                    "This is your report."
                );
            } else {
                const form = document.createElement("form");

                form.method = "POST";
                form.action =
                    `/claim/${encodeURIComponent(item.id)}`;
                form.className = "mt-3";

                const label = addTextElement(
                    form,
                    "label",
                    "form-label",
                    "Why is this your item?"
                );

                label.htmlFor = `claim-message-${item.id}`;

                const textarea = document.createElement("textarea");

                textarea.id = `claim-message-${item.id}`;
                textarea.name = "message";
                textarea.className = "form-control mb-2";
                textarea.rows = 3;
                textarea.maxLength = 1000;
                textarea.required = true;
                textarea.placeholder =
                    "Describe identifying details to help verify ownership.";

                form.appendChild(textarea);

                const submit = document.createElement("button");

                submit.type = "submit";
                submit.className = "btn btn-success w-100";
                submit.textContent = "Submit Claim Request";

                form.appendChild(submit);
                content.appendChild(form);
            }
        } else if (
            item.type === "Found" &&
            item.status === "Claimed"
        ) {
            addTextElement(
                content,
                "p",
                "text-secondary small mt-3 mb-0",
                "Claim approved — awaiting return."
            );
        } else if (
            item.type === "Found" &&
            item.status === "Returned"
        ) {
            addTextElement(
                content,
                "p",
                "text-success small mt-3 mb-0",
                "Item returned to its owner."
            );
        }

        article.appendChild(content);
        column.appendChild(article);

        return column;
    }

    // Load items from the Flask API.
    async function loadItems() {
        if (!itemGrid) {
            return;
        }

        try {
            const response = await fetch("/api/items");

            if (!response.ok) {
                throw new Error("Failed to fetch items");
            }

            const data = await response.json();

            if (!data.success || !Array.isArray(data.items)) {
                throw new Error("Invalid API response");
            }

            itemGrid.replaceChildren();

            if (data.items.length === 0) {
                const message = document.createElement("div");
                message.className = "col-12";

                const empty = document.createElement("div");
                empty.className = "empty-state";

                addTextElement(
                    empty, "h3", "", "No reports yet"
                );

                addTextElement(
                    empty,
                    "p",
                    "",
                    "Be the first to report a lost or found item."
                );

                message.appendChild(empty);
                itemGrid.appendChild(message);

                return;
            }

            data.items.forEach(function (item) {
                itemGrid.appendChild(createItemCard(item));
            });

            // Apply current search/filter after loading cards.
            filterItems();
        } catch (error) {
            console.error("API error:", error);

            itemGrid.replaceChildren();

            const message = document.createElement("p");

            message.className = "text-danger text-center";
            message.textContent =
                "Unable to load items. Please refresh the page.";

            itemGrid.appendChild(message);
        }
    }

    loadItems();

    // Validate the report form before submission.
    const reportForm = document.getElementById("reportForm");

    if (reportForm) {
        reportForm.addEventListener("submit", function (event) {
            if (!reportForm.reportValidity()) {
                event.preventDefault();
            }
        });
    }
});
