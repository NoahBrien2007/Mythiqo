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
    cell.style.position = "relative";
    cell.innerHTML = `
        <div class="new-deck-icon">+</div>
        <button class="btn btn-import" id="btn-import-deck" style="position: absolute; bottom: 15px; right: 15px; min-width: auto; height: 32px; padding: 0 12px; font-size: 11px; z-index: 10;">IMPORT</button>
    `;
    
    const importBtn = cell.querySelector("#btn-import-deck");
    importBtn.onclick = (e) => {
        e.stopPropagation();
        const inputImportFile = document.getElementById("input-import-file");
        if (inputImportFile) {
            inputImportFile.click();
        }
    };

    cell.onclick = (e) => {
        if (e.target.id === "btn-import-deck") return;
        openModal();
    };
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

    // Remove Add to Deck button if it exists in sidebar (since we are on Decks page)
    const existingAddContainer = sidebar.querySelector(".sidebar-add-container");
    if (existingAddContainer) {
        existingAddContainer.remove();
    }

    sidebar.classList.add("active");
};

const closeSidebar = () => {
    sidebar.classList.remove("active");
    document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));
    detailGridContainer.classList.remove("toggled");
};

sidebarClose.onclick = closeSidebar;

// Custom Toast notification
const showToast = (message, isError = false) => {
    let toast = document.getElementById("deck-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "deck-toast";
        document.body.appendChild(toast);
    }
    toast.className = `deck-toast ${isError ? 'deck-toast-error' : 'deck-toast-ok'}`;
    toast.textContent = message;
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add("active");
    }, 10);
    
    // Auto-remove
    setTimeout(() => {
        toast.classList.remove("active");
    }, 3000);
};

// Render Warnings
const renderWarnings = (deck) => {
    const warningsPanel = document.getElementById("deck-warnings");
    if (!warningsPanel) return;

    warningsPanel.innerHTML = "";
    if (!window.CardDetailsShared || !window.CardDetailsShared.validateDeck) return;

    const warnings = window.CardDetailsShared.validateDeck(deck);
    
    const errors = warnings.filter(w => w.level === "error").length;
    const warns = warnings.filter(w => w.level === "warn").length;
    const total = warnings.length;

    let summaryText = "";
    let overallLevel = "ok";
    let summaryIcon = "🟢";

    if (errors > 0) {
        overallLevel = "error";
        summaryIcon = "🔴";
        summaryText = `${total} Error${total > 1 ? 's' : ''} / Warning${total > 1 ? 's' : ''}`;
    } else if (warns > 0) {
        overallLevel = "warn";
        summaryIcon = "🟡";
        summaryText = `${total} Warning${total > 1 ? 's' : ''}`;
    } else {
        summaryText = "Valid Commander Deck";
    }

    const summaryDiv = document.createElement("div");
    summaryDiv.className = `warning-summary ${overallLevel}`;
    
    // If there are warnings/errors, append the hover dropdown
    if (total > 0) {
        summaryDiv.innerHTML = `
            <span>${summaryIcon} ${summaryText}</span>
            <span style="font-size: 10px; opacity: 0.7; pointer-events: none;">(Hover to view)</span>
            <div class="warning-detail-dropdown"></div>
        `;
        
        const dropdown = summaryDiv.querySelector(".warning-detail-dropdown");
        warnings.forEach(w => {
            const item = document.createElement("div");
            item.className = `warning-detail-item ${w.level}`;
            item.innerHTML = w.message;
            dropdown.appendChild(item);
        });
    } else {
        summaryDiv.innerHTML = `<span>${summaryIcon} ${summaryText}</span>`;
    }

    warningsPanel.appendChild(summaryDiv);
};

const openDeckDetail = (deckIndex) => {
    currentDeckIndex = deckIndex;
    closeSidebar();
    const deck = decks[deckIndex];
    viewHub.classList.remove("active");
    viewDetail.classList.add("active");

    detailDeckName.textContent = deck.name;
    detailCommanderName.textContent = deck.commander.name;

    // Call validation and update Warnings UI
    renderWarnings(deck);

    // Stacking logic: group by oracle_id (or name if oracle_id is missing) and count them
    // Commander goes into its own group as a special stack of 1
    const grouped = { Commander: [{ card: deck.commander, count: 1 }] };

    deck.cards.forEach(card => {
        const category = categorizeCard(card.type_line);
        if (!grouped[category]) grouped[category] = [];
        
        const key = card.oracle_id || card.name;
        const existing = grouped[category].find(item => (item.card.oracle_id || item.card.name) === key);
        if (existing) {
            existing.count++;
        } else {
            grouped[category].push({ card, count: 1 });
        }
    });

    deckListWrapper.innerHTML = "";
    detailGridContainer.innerHTML = "";

    const order = ["Commander", "Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Lands", "Other"];

    order.forEach(category => {
        if (!grouped[category] || grouped[category].length === 0) return;

        // Count category total cards (sum of counts)
        const totalCatCards = grouped[category].reduce((sum, item) => sum + item.count, 0);

        const catDiv = document.createElement("div");
        catDiv.className = "list-category";
        catDiv.textContent = `${category} (${totalCatCards})`;
        deckListWrapper.appendChild(catDiv);

        const ul = document.createElement("ul");
        ul.className = "deck-list";

        const gridSection = document.createElement("div");
        gridSection.innerHTML = `
            <h2 class="type-section-header">
                ${category} <span class="type-section-count">${totalCatCards}</span>
            </h2>
            <div class="type-grid"></div>
        `;
        const typeGrid = gridSection.querySelector(".type-grid");

        grouped[category].forEach(entry => {
            const card = entry.card;
            const count = entry.count;

            const li = document.createElement("li");
            li.className = "deck-list-item";
            li.innerHTML = `
                <span class="item-qty">${count}</span>
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

            // Append stack badge and controls if not commander
            if (category !== "Commander") {
                const badge = document.createElement("div");
                badge.className = `card-stack-badge ${count > 1 ? 'has-multiple' : ''}`;
                badge.innerHTML = `
                    <span class="stack-count">${count > 1 ? '×' + count : '×1'}</span>
                    <div class="stack-controls">
                        <button class="stack-btn minus-btn" title="Decrease Quantity">&minus;</button>
                        <button class="stack-btn plus-btn" title="Increase Quantity">&plus;</button>
                    </div>
                `;

                badge.onclick = (e) => {
                    e.stopPropagation();
                };

                const minusBtn = badge.querySelector(".minus-btn");
                const plusBtn = badge.querySelector(".plus-btn");

                minusBtn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = deck.cards.findIndex(c => (c.oracle_id || c.name) === (card.oracle_id || card.name));
                    if (idx !== -1) {
                        deck.cards.splice(idx, 1);
                        if (window.CardDetailsShared) {
                            window.CardDetailsShared.saveDecks(decks);
                        }
                        openDeckDetail(deckIndex);
                    }
                };

                plusBtn.onclick = (e) => {
                    e.stopPropagation();
                    deck.cards.push(card);
                    if (window.CardDetailsShared) {
                        window.CardDetailsShared.saveDecks(decks);
                    }
                    openDeckDetail(deckIndex);
                };

                cardDiv.appendChild(badge);
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

        decks.push(newDeck);
        if (window.CardDetailsShared) {
            window.CardDetailsShared.saveDecks(decks);
        }
        closeModal();
        renderHub();
        showToast(`Deck "${newDeck.name}" created!`);
    } catch (err) {
        alert("Could not find a card matching that Commander name.");
        createBtn.textContent = "CREATE DECK";
        createBtn.disabled = false;
    }
});

// Import Deck wiring
const inputImportFile = document.getElementById("input-import-file");

if (inputImportFile) {
    inputImportFile.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            if (window.CardDetailsShared && window.CardDetailsShared.importDeck) {
                const imported = await window.CardDetailsShared.importDeck(file);
                showToast(`Deck "${imported.name}" imported successfully!`);
                decks = window.CardDetailsShared.loadDecks();
                renderHub();
            }
        } catch (err) {
            showToast(err, true);
        } finally {
            inputImportFile.value = "";
        }
    };
}

// Export Deck wiring
const btnExportDeck = document.getElementById("btn-export-deck");
if (btnExportDeck) {
    btnExportDeck.onclick = () => {
        if (currentDeckIndex !== -1) {
            const deck = decks[currentDeckIndex];
            if (window.CardDetailsShared && window.CardDetailsShared.exportDeck) {
                window.CardDetailsShared.exportDeck(deck);
                showToast(`Exported "${deck.name}"!`);
            }
        }
    };
}

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