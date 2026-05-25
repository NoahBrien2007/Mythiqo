const viewHub = document.getElementById("view-hub");
const viewDetail = document.getElementById("view-detail");
const deckHubGrid = document.getElementById("deck-hub-grid");
const modalBackdrop = document.getElementById("modal-backdrop");
const closeModalBtn = document.getElementById("close-modal");
const formCreateDeck = document.getElementById("form-create-deck");
const createBtn = document.getElementById("btn-create-deck");

const detailDeckName = document.getElementById("detail-deck-name");
const detailCommanderName = document.getElementById("detail-commander-name");
const deckListWrapper = document.getElementById("deck-list-wrapper");
const detailGridContainer = document.getElementById("detail-grid-container");
const btnBackHub = document.getElementById("btn-back-hub");

const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebar-close");
const sidebarImg = document.getElementById("sidebar-img");
const sidebarTitle = document.getElementById("sidebar-title");
const sidebarType = document.getElementById("sidebar-type");
const sidebarText = document.getElementById("sidebar-text");
const sidebarStats = document.getElementById("sidebar-stats");

let decks = [];

const mockCardsToFill = [
    "Sol Ring",
    "Arcane Signet",
    "Command Tower",
    "Swords to Plowshares"
];

const openModal = () => {
    formCreateDeck.reset();
    createBtn.textContent = "CREATE DECK";
    createBtn.disabled = false;
    modalBackdrop.classList.add("active");
};

const closeModal = () => {
    modalBackdrop.classList.remove("active");
};

const createNewDeckCell = () => {
    const cell = document.createElement("div");
    cell.className = "deck-cell new-deck-cell";
    cell.innerHTML = `<div class="new-deck-icon">+</div>`;
    cell.onclick = openModal;
    return cell;
};

const renderHub = () => {
    deckHubGrid.innerHTML = "";
    deckHubGrid.appendChild(createNewDeckCell());

    decks.forEach((deck, index) => {
        const cell = document.createElement("div");
        cell.className = "deck-cell";

        const artUrl = deck.commander.image_uris ? deck.commander.image_uris.art_crop : (deck.commander.card_faces ? deck.commander.card_faces[0].image_uris.art_crop : "");

        cell.innerHTML = `
            <img class="deck-art" src="${artUrl}" alt="${deck.commander.name}">
            <div class="deck-info-overlay">
                <h3 class="deck-name">${deck.name}</h3>
                <span class="deck-commander-name">${deck.commander.name}</span>
            </div>
        `;

        cell.onclick = () => openDeckDetail(index);
        deckHubGrid.appendChild(cell);
    });
};

const categorizeCard = (typeLine) => {
    const t = typeLine.toLowerCase();
    if (t.includes("creature")) return "Creatures";
    if (t.includes("planeswalker")) return "Planeswalkers";
    if (t.includes("instant")) return "Instants";
    if (t.includes("sorcery")) return "Sorceries";
    if (t.includes("artifact")) return "Artifacts";
    if (t.includes("enchantment")) return "Enchantments";
    if (t.includes("land")) return "Lands";
    return "Other";
};

const openSidebar = (cardData) => {
    const imgUrl = cardData.image_uris ? cardData.image_uris.normal : cardData.card_faces[0].image_uris.normal;
    sidebarImg.src = imgUrl;
    sidebarTitle.textContent = cardData.name || "";
    sidebarType.textContent = cardData.type_line || "";
    sidebarText.textContent = cardData.oracle_text || (cardData.card_faces ? cardData.card_faces[0].oracle_text : "");

    if (cardData.power && cardData.toughness) {
        sidebarStats.textContent = `${cardData.power} / ${cardData.toughness}`;
    } else if (cardData.loyalty) {
        sidebarStats.textContent = `Loyalty: ${cardData.loyalty}`;
    } else {
        sidebarStats.textContent = "";
    }

    sidebar.classList.add("active");
};

const closeSidebar = () => {
    sidebar.classList.remove("active");
    document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));
    detailGridContainer.classList.remove("toggled");
};

sidebarClose.onclick = closeSidebar;

const openDeckDetail = (deckIndex) => {
    closeSidebar();
    const deck = decks[deckIndex];
    viewHub.classList.remove("active");
    viewDetail.classList.add("active");

    detailDeckName.textContent = deck.name;
    detailCommanderName.textContent = deck.commander.name;

    const grouped = { Commander: [deck.commander] };

    deck.cards.forEach(card => {
        const category = categorizeCard(card.type_line);
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(card);
    });

    deckListWrapper.innerHTML = "";
    detailGridContainer.innerHTML = "";

    const order = ["Commander", "Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Lands", "Other"];

    order.forEach(category => {
        if (!grouped[category] || grouped[category].length === 0) return;

        const catDiv = document.createElement("div");
        catDiv.className = "list-category";
        catDiv.textContent = `${category} (${grouped[category].length})`;
        deckListWrapper.appendChild(catDiv);

        const ul = document.createElement("ul");
        ul.className = "deck-list";

        const gridSection = document.createElement("div");
        gridSection.innerHTML = `
            <h2 class="type-section-header">
                ${category} <span class="type-section-count">${grouped[category].length}</span>
            </h2>
            <div class="type-grid"></div>
        `;
        const typeGrid = gridSection.querySelector(".type-grid");

        grouped[category].forEach(card => {
            const li = document.createElement("li");
            li.className = "deck-list-item";
            li.innerHTML = `
                <span class="item-qty">1</span>
                <span class="item-name">${card.name}</span>
            `;
            li.onclick = () => {
                openSidebar(card);
            };
            ul.appendChild(li);

            const cardDiv = document.createElement("div");
            cardDiv.className = "card";
            const imgUrl = card.image_uris ? card.image_uris.normal : (card.card_faces ? card.card_faces[0].image_uris.normal : "");
            cardDiv.innerHTML = `<img src="${imgUrl}" alt="${card.name}">`;

            cardDiv.onclick = () => {
                const active = cardDiv.classList.contains("active");
                document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));

                if (active) {
                    detailGridContainer.classList.remove("toggled");
                    sidebar.classList.remove("active");
                } else {
                    detailGridContainer.classList.add("toggled");
                    cardDiv.classList.add("active");
                    openSidebar(card);
                }
            };

            typeGrid.appendChild(cardDiv);
        });

        deckListWrapper.appendChild(ul);
        detailGridContainer.appendChild(gridSection);
    });
};

btnBackHub.addEventListener("click", () => {
    closeSidebar();
    viewDetail.classList.remove("active");
    viewHub.classList.add("active");
});

closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
});

formCreateDeck.addEventListener("submit", async (e) => {
    e.preventDefault();
    createBtn.textContent = "SEARCHING...";
    createBtn.disabled = true;

    const name = document.getElementById("input-deck-name").value.trim();
    const cmdName = document.getElementById("input-commander").value.trim();
    const info = document.getElementById("input-info").value.trim();
    const labels = document.getElementById("input-labels").value.trim();

    try {
        const cmdRes = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cmdName)}`);
        if (!cmdRes.ok) throw new Error("Commander not found");
        const commanderData = await cmdRes.json();

        const newDeck = {
            id: Date.now(),
            name: name || "Untitled Deck",
            commander: commanderData,
            info: info,
            labels: labels,
            cards: []
        };

        for (const mCard of mockCardsToFill) {
            const mRes = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(mCard)}`);
            if (mRes.ok) {
                const mData = await mRes.json();
                newDeck.cards.push(mData);
            }
        }

        decks.push(newDeck);
        closeModal();
        renderHub();
    } catch (err) {
        alert("Could not find a card matching that Commander name.");
        createBtn.textContent = "CREATE DECK";
        createBtn.disabled = false;
    }
});

const topbarSearchInput = document.getElementById("topbar-search-input");
const triggerTopbarSearch = () => {
    const val = topbarSearchInput.value.trim();
    if (val) {
        window.location.href = `search.html?q=${encodeURIComponent(val)}`;
    }
};
topbarSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        triggerTopbarSearch();
    }
});
document.getElementById("topbar-search-trigger").addEventListener("click", triggerTopbarSearch);

renderHub();