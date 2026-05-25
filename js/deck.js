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

// Initialize decks from localStorage
let decks = [];
if (window.CardDetailsShared) {
    decks = window.CardDetailsShared.loadDecks();
}
let currentDeckIndex = -1;

const mockCardsToFill = [
    "Sol Ring",
    "Arcane Signet",
    "Command Tower",
    "Swords to Plowshares"
];

// Initialize card details shared containers
window.addEventListener("DOMContentLoaded", () => {
    if (window.CardDetailsShared) {
        window.CardDetailsShared.init();
    }
});

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
    const hasFaces = cardData.card_faces && cardData.card_faces.length >= 2;
    let imgUrl = "";
    if (cardData.image_uris && cardData.image_uris.normal) {
        imgUrl = cardData.image_uris.normal;
    } else if (hasFaces && cardData.card_faces[0].image_uris && cardData.card_faces[0].image_uris.normal) {
        imgUrl = cardData.card_faces[0].image_uris.normal;
    }

    sidebarImg.src = imgUrl;

    // Rich Title with Mana Cost icons
    const manaCostStr = cardData.mana_cost || (hasFaces ? cardData.card_faces[0].mana_cost : "");
    const manaHTML = window.CardDetailsShared ? window.CardDetailsShared.parseManaCost(manaCostStr) : "";
    sidebarTitle.innerHTML = `${cardData.name || ""} <span style="display:inline-flex; gap:2px; margin-left:8px;">${manaHTML}</span>`;
    sidebarType.textContent = cardData.type_line || "";

    // Stats
    if (cardData.power && cardData.toughness) {
        sidebarStats.textContent = `${cardData.power} / ${cardData.toughness}`;
    } else if (cardData.loyalty) {
        sidebarStats.textContent = `Loyalty: ${cardData.loyalty}`;
    } else if (hasFaces && cardData.card_faces[0].power && cardData.card_faces[0].toughness) {
        sidebarStats.textContent = `${cardData.card_faces[0].power} / ${cardData.card_faces[0].toughness}`;
    } else if (hasFaces && cardData.card_faces[0].loyalty) {
        sidebarStats.textContent = `Loyalty: ${cardData.card_faces[0].loyalty}`;
    } else {
        sidebarStats.textContent = "";
    }

    // Rich text construction
    let oracleText = cardData.oracle_text || "";
    if (!oracleText && hasFaces) {
        oracleText = cardData.card_faces.map(f => `[${f.name}]\n${f.oracle_text || ""}`).join("\n\n");
    }
    if (window.CardDetailsShared) {
        oracleText = window.CardDetailsShared.replaceSymbolsInText(oracleText);
    }

    let flavorText = cardData.flavor_text || "";
    if (!flavorText && hasFaces && cardData.card_faces[0].flavor_text) {
        flavorText = cardData.card_faces[0].flavor_text;
    }

    let pricesHTML = "";
    if (cardData.prices) {
        const usd = cardData.prices.usd ? `$${cardData.prices.usd}` : "N/A";
        const foil = cardData.prices.usd_foil ? `$${cardData.prices.usd_foil}` : "N/A";
        pricesHTML = `<div style="margin-top: 10px; font-size:12px; color:var(--green2);">Price: USD: ${usd} | Foil: ${foil}</div>`;
    }

    let rarityClass = `rarity-${cardData.rarity}`;
    let artistStr = cardData.artist ? `Art by: ${cardData.artist}` : "";
    let setStr = cardData.set_name ? `Set: ${cardData.set_name} (${cardData.set.toUpperCase()})` : "";

    let legalityList = "";
    if (cardData.legalities) {
        const fms = ["standard", "modern", "commander", "pioneer"];
        legalityList = `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">` +
            fms.map(f => {
                const isLegal = cardData.legalities[f] === "legal";
                const color = isLegal ? "var(--green2)" : "#666";
                const border = isLegal ? "1px solid var(--green3)" : "1px solid #444";
                return `<span style="font-size:10px; text-transform:uppercase; padding:2px 6px; border:${border}; color:${color}; background:rgba(0,0,0,0.3);">${f}</span>`;
            }).join("") + `</div>`;
    }

    sidebarText.innerHTML = `
        <div style="margin-bottom:12px; line-height:1.5;">${oracleText.replace(/\n/g, "<br>")}</div>
        ${pricesHTML}
        ${legalityList}
    `;

    // Compact Sidebar Add to Deck Button & Dropdown Setup
    let addContainer = sidebar.querySelector(".sidebar-add-container");
    if (!addContainer) {
        addContainer = document.createElement("div");
        addContainer.className = "sidebar-add-container";
        addContainer.style.position = "relative";
        addContainer.style.marginTop = "14px";
        addContainer.innerHTML = `
            <button class="btn" id="sidebar-add-btn" style="width: 100%;">ADD TO DECK</button>
            <div class="sidebar-decks-dropdown" id="sidebar-decks-dropdown" style="display: none; position: absolute; bottom: 100%; left: 0; width: 100%; background: #111; border: 1px solid var(--green3); box-shadow: 0 -4px 10px rgba(0,255,0,0.25); z-index: 100; max-height: 200px; overflow-y: auto;"></div>
        `;
        sidebar.querySelector(".sidebar-inner").appendChild(addContainer);
    }

    const sidebarAddBtn = addContainer.querySelector("#sidebar-add-btn");
    const sidebarDecksDropdown = addContainer.querySelector("#sidebar-decks-dropdown");

    sidebarAddBtn.onclick = (e) => {
        e.stopPropagation();
        const active = sidebarDecksDropdown.style.display === "block";
        sidebarDecksDropdown.style.display = active ? "none" : "block";
    };

    const setupDropdownOptions = () => {
        const decksList = window.CardDetailsShared ? window.CardDetailsShared.loadDecks() : [];
        sidebarDecksDropdown.innerHTML = "";

        if (decksList.length === 0) {
            const item = document.createElement("div");
            item.style.padding = "10px";
            item.style.color = "#888";
            item.style.fontSize = "12px";
            item.style.cursor = "pointer";
            item.textContent = "+ Create New Deck...";
            item.onclick = () => {
                sidebarDecksDropdown.style.display = "none";
                const name = prompt("Enter new deck name:", `${cardData.name} Commander Deck`);
                if (name) {
                    const newD = window.CardDetailsShared.createDeckFromCard(name, cardData);
                    alert(`Created deck "${newD.name}" with ${cardData.name} as Commander!`);
                    setupDropdownOptions();
                }
            };
            sidebarDecksDropdown.appendChild(item);
        } else {
            decksList.forEach(d => {
                const item = document.createElement("div");
                item.style.padding = "10px";
                item.style.fontSize = "12px";
                item.style.cursor = "pointer";
                item.style.borderBottom = "1px solid #222";
                item.textContent = d.name;
                item.onmouseover = () => {
                    item.style.background = "var(--green3)";
                    item.style.color = "var(--black)";
                };
                item.onmouseout = () => {
                    item.style.background = "transparent";
                    item.style.color = "#ccc";
                };
                item.onclick = () => {
                    sidebarDecksDropdown.style.display = "none";
                    const currentDecks = window.CardDetailsShared.loadDecks();
                    const targetDeck = currentDecks.find(td => td.id == d.id);
                    if (targetDeck) {
                        targetDeck.cards.push(cardData);
                        window.CardDetailsShared.saveDecks(currentDecks);
                        alert(`Added ${cardData.name} to ${targetDeck.name}!`);

                        // Reactive refresh on the deck details view
                        decks = currentDecks;
                        if (currentDeckIndex !== -1 && decks[currentDeckIndex].id == targetDeck.id) {
                            openDeckDetail(currentDeckIndex);
                        }
                    }
                };
                sidebarDecksDropdown.appendChild(item);
            });

            const createItem = document.createElement("div");
            createItem.style.padding = "10px";
            createItem.style.fontSize = "12px";
            createItem.style.cursor = "pointer";
            createItem.style.color = "var(--green2)";
            createItem.textContent = "+ Create New Deck...";
            createItem.onmouseover = () => {
                createItem.style.background = "var(--green3)";
                createItem.style.color = "var(--black)";
            };
            createItem.onmouseout = () => {
                createItem.style.background = "transparent";
                createItem.style.color = "var(--green2)";
            };
            createItem.onclick = () => {
                sidebarDecksDropdown.style.display = "none";
                const name = prompt("Enter new deck name:", `${cardData.name} Commander Deck`);
                if (name) {
                    const newD = window.CardDetailsShared.createDeckFromCard(name, cardData);
                    alert(`Created deck "${newD.name}" with ${cardData.name} as Commander!`);
                    setupDropdownOptions();
                }
            };
            sidebarDecksDropdown.appendChild(createItem);
        }
    };

    setupDropdownOptions();

    document.addEventListener("click", () => {
        if (sidebarDecksDropdown) sidebarDecksDropdown.style.display = "none";
    });

    sidebar.classList.add("active");
};

const closeSidebar = () => {
    sidebar.classList.remove("active");
    document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));
    detailGridContainer.classList.remove("toggled");
};

sidebarClose.onclick = closeSidebar;

const openDeckDetail = (deckIndex) => {
    currentDeckIndex = deckIndex;
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

            // Enable right-click context menu on list items as well
            li.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                if (window.CardDetailsShared) {
                    window.CardDetailsShared.showContextMenu(e, card, {
                        inDeck: true,
                        deckId: deck.id,
                        onUpdate: () => {
                            decks = window.CardDetailsShared.loadDecks();
                            const currentIdx = decks.findIndex(d => d.id === deck.id);
                            if (currentIdx !== -1) {
                                openDeckDetail(currentIdx);
                            } else {
                                btnBackHub.click();
                            }
                        }
                    });
                }
            });

            ul.appendChild(li);

            const cardDiv = document.createElement("div");
            cardDiv.className = "card";

            // Wrap in a 3D flip card structure
            if (window.CardDetailsShared) {
                cardDiv.innerHTML = window.CardDetailsShared.createFlipCardHTML(card);
            } else {
                const imgUrl = card.image_uris ? card.image_uris.normal : (card.card_faces ? card.card_faces[0].image_uris.normal : "");
                cardDiv.innerHTML = `<img src="${imgUrl}" alt="${card.name}">`;
            }

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

            // Enable right-click context menu on grid card items
            cardDiv.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                if (window.CardDetailsShared) {
                    window.CardDetailsShared.showContextMenu(e, card, {
                        inDeck: true,
                        deckId: deck.id,
                        onUpdate: () => {
                            decks = window.CardDetailsShared.loadDecks();
                            const currentIdx = decks.findIndex(d => d.id === deck.id);
                            if (currentIdx !== -1) {
                                openDeckDetail(currentIdx);
                            } else {
                                btnBackHub.click();
                            }
                        }
                    });
                }
            });

            typeGrid.appendChild(cardDiv);
        });

        deckListWrapper.appendChild(ul);
        detailGridContainer.appendChild(gridSection);
    });
};

btnBackHub.addEventListener("click", () => {
    currentDeckIndex = -1;
    closeSidebar();
    viewDetail.classList.remove("active");
    viewHub.classList.add("active");
    renderHub(); // Refresh hub display in case decks were edited via context menu
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
        if (window.CardDetailsShared) {
            window.CardDetailsShared.saveDecks(decks);
        }
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