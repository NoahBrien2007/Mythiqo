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

// Stats state (declared early so openDeckDetail can reference)
let statsActive = false;
let savedDeckListHTML = '';
let currentChartIdx = 0;
let chartAnimId = null;
let chartAnimStart = 0;

function exitStatsView() {
    if (!statsActive) return;
    statsActive = false;
    currentChartIdx = 0;
    const btn = document.getElementById("btn-stats-deck");
    if (btn) btn.classList.remove('active');
    const wrapper = document.getElementById('deck-list-wrapper');
    if (wrapper && savedDeckListHTML) {
        wrapper.innerHTML = savedDeckListHTML;
        savedDeckListHTML = '';
    }
    if (chartAnimId) { cancelAnimationFrame(chartAnimId); chartAnimId = null; }
}

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
    if (statsActive) exitStatsView();
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

// ======== DECK STATISTICS ========
const btnStatsDeck = document.getElementById("btn-stats-deck");

const CHART_DEFS = [
    { id: 'mana-curve', label: 'Mana Curve', donut: false },
    { id: 'card-types', label: 'Card Types', donut: false },
    { id: 'color-id', label: 'Color Identity', donut: false },
    { id: 'mana-pips', label: 'Mana Symbols', donut: false },
    { id: 'rarity', label: 'Rarity', donut: true },
    { id: 'legendary', label: 'Legendary', donut: false },
    { id: 'color-weight', label: 'Color Weight', donut: true },
    { id: 'type-groups', label: 'Type Groups', donut: false }
];

const CHART_COLORS = ['#ff6b6b', '#ffd93d', '#6bcbff', '#7aff66', '#ff9ff3', '#ff9f43', '#00d2d3', '#a29bfe', '#f368e0', '#54a0ff'];

function getDeckStats(deck) {
    if (!deck) return { total: 0, avgCmc: '0', types: {} };
    const all = [deck.commander, ...deck.cards];
    const counts = { Creatures: 0, Instants: 0, Sorceries: 0, Artifacts: 0, Enchantments: 0, Planeswalkers: 0, Lands: 0, Other: 0 };
    let totalCmc = 0;
    all.forEach(c => {
        const t = c.type_line.toLowerCase();
        if (t.includes('creature')) counts.Creatures++;
        else if (t.includes('instant')) counts.Instants++;
        else if (t.includes('sorcery')) counts.Sorceries++;
        else if (t.includes('artifact')) counts.Artifacts++;
        else if (t.includes('enchantment')) counts.Enchantments++;
        else if (t.includes('planeswalker')) counts.Planeswalkers++;
        else if (t.includes('land')) counts.Lands++;
        else counts.Other++;
        totalCmc += c.cmc || 0;
    });
    return { total: all.length, avgCmc: all.length ? (totalCmc / all.length).toFixed(1) : '0', types: counts };
}

function computeChartData(deck, idx) {
    if (!deck) return { labels: [], values: [] };
    const all = [deck.commander, ...deck.cards];
    switch (idx) {
        case 0: {
            const b = { '0-1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
            all.forEach(c => { const v = Math.floor(c.cmc || 0); if (v <= 1) b['0-1']++; else if (v >= 7) b['7+']++; else b[String(v)]++; });
            return { labels: Object.keys(b), values: Object.values(b) };
        }
        case 1: {
            const t = {};
            all.forEach(c => { const cat = categorizeCard(c.type_line); t[cat] = (t[cat] || 0) + 1; });
            const order = ["Creatures", "Planeswalkers", "Instants", "Sorceries", "Artifacts", "Enchantments", "Lands", "Other"];
            const labels = order.filter(k => t[k]);
            return { labels, values: labels.map(k => t[k]) };
        }
        case 2: {
            const c = { W: 0, U: 0, B: 0, R: 0, G: 0 };
            all.forEach(card => (card.colors || card.color_identity || []).forEach(col => { if (col in c) c[col]++; }));
            return { labels: Object.keys(c), values: Object.values(c) };
        }
        case 3: {
            const p = { W: 0, U: 0, B: 0, R: 0, G: 0 };
            all.forEach(card => {
                const m = (card.mana_cost || '').match(/\{[WUBRG]\}/g);
                if (m) m.forEach(s => { const col = s[1]; if (col in p) p[col]++; });
            });
            return { labels: Object.keys(p), values: Object.values(p) };
        }
        case 4: {
            const r = { common: 0, uncommon: 0, rare: 0, mythic: 0, special: 0 };
            all.forEach(c => { const v = c.rarity || 'common'; if (v in r) r[v]++; });
            const labels = Object.keys(r).filter(k => r[k] > 0);
            return { labels, values: labels.map(k => r[k]) };
        }
        case 5: {
            const l = { 'Legendary Creature': 0, 'Legendary Other': 0, 'Non-Legendary': 0 };
            all.forEach(c => {
                const t = c.type_line.toLowerCase();
                const leg = t.includes('legendary');
                if (!leg) l['Non-Legendary']++;
                else if (t.includes('creature')) l['Legendary Creature']++;
                else l['Legendary Other']++;
            });
            const labels = Object.keys(l).filter(k => l[k] > 0);
            return { labels, values: labels.map(k => l[k]) };
        }
        case 6: {
            const w = { 'Colorless': 0, 'Mono-Color': 0, 'Multi-Color': 0 };
            all.forEach(c => {
                const cols = c.colors || c.color_identity || [];
                if (cols.length === 0) w['Colorless']++;
                else if (cols.length === 1) w['Mono-Color']++;
                else w['Multi-Color']++;
            });
            const labels = Object.keys(w).filter(k => w[k] > 0);
            return { labels, values: labels.map(k => w[k]) };
        }
        case 7: {
            const g = { 'Lands': 0, 'Creatures': 0, 'Spells': 0, 'Other Perms': 0 };
            all.forEach(c => {
                const t = c.type_line.toLowerCase();
                if (t.includes('land')) g['Lands']++;
                else if (t.includes('creature')) g['Creatures']++;
                else if (t.includes('instant') || t.includes('sorcery')) g['Spells']++;
                else g['Other Perms']++;
            });
            const labels = Object.keys(g).filter(k => g[k] > 0);
            return { labels, values: labels.map(k => g[k]) };
        }
    }
}

function drawLegend(ctx, labels, values, w, xStart, yStart) {
    const sq = 8;
    const gap = 12;
    const maxW = w - xStart - 8;
    let row = 0;
    let x = xStart;
    let lineH = 18;

    labels.forEach((label, i) => {
        ctx.font = '10px Arial';
        const tw = ctx.measureText(label).width;
        const itemW = sq + 4 + tw + gap;

        if (x + itemW > xStart + maxW && x > xStart) {
            row++;
            x = xStart;
        }

        ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
        ctx.fillRect(x, yStart + row * lineH + 2, sq, sq);

        ctx.fillStyle = '#bbb';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + sq + 4, yStart + row * lineH + sq / 2 + 1);

        x += itemW;
    });

    return (row + 1) * lineH + 4;
}

function drawChart(ctx, data, progress, w, h, idx) {
    const { labels, values } = data;
    if (!labels.length) { ctx.fillStyle = '#666'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.fillText('No data', w/2, h/2); return; }

    const maxVal = Math.max(...values, 1);
    const isDonut = CHART_DEFS[idx].donut;
    const total = values.reduce((a, b) => a + b, 0);

    ctx.clearRect(0, 0, w, h);

    if (isDonut) {
        if (!total) return;
        const cx = w/2, cy = h/2 - 12;
        const outerR = Math.min(w, h) * 0.32;
        const innerR = outerR * 0.56;

        values.forEach((val, i) => {
            const slice = (val / total) * Math.PI * 2 * progress;
            const offset = values.slice(0, i).reduce((a, v) => a + (v / total) * Math.PI * 2, -Math.PI/2);

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, offset, offset + slice);
            ctx.arc(cx, cy, innerR, offset + slice, offset, true);
            ctx.closePath();

            ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
            ctx.fill();
        });

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#7aff66';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total, cx, cy - 4);
        ctx.fillStyle = '#4ade80';
        ctx.font = '9px Arial';
        ctx.fillText('cards', cx, cy + 14);

        drawLegend(ctx, labels, values, w, 10, cy + outerR + 16);
        return;
    }

    // Bar chart (vertical)
    const pad = { top: 16, right: 14, bottom: 80, left: 14 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.min(chartW / labels.length * 0.55, 36);
    const gap = labels.length > 1 ? (chartW - barW * labels.length) / (labels.length + 1) : chartW * 0.3;

    // Grid lines
    ctx.strokeStyle = 'rgba(74,222,128,0.06)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
        const gy = pad.top + chartH * (1 - g/4);
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(w - pad.right, gy);
        ctx.stroke();
    }

    labels.forEach((label, i) => {
        const x = pad.left + gap + i * (barW + gap);
        const targetH = ((values[i] / maxVal) * chartH) * progress;
        const y = pad.top + chartH - targetH;

        ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
        ctx.shadowColor = CHART_COLORS[i % CHART_COLORS.length];
        ctx.shadowBlur = 6;

        const r = 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, pad.top + chartH);
        ctx.lineTo(x, pad.top + chartH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        if (progress > 0.2) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(values[i], x + barW/2, y - 3);
        }

        ctx.fillStyle = '#929292';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + barW/2, pad.top + chartH + 4);
    });

    drawLegend(ctx, labels, values, w, 10, pad.top + chartH + 20);
}

function renderChart(idx, animate = true) {
    const canvas = document.getElementById('stats-canvas');
    if (!canvas) return;
    const deck = decks[currentDeckIndex];
    if (!deck) return;
    
    const wrap = canvas.parentElement;
    const wrapW = wrap.clientWidth - 4;
    const wrapH = wrap.clientHeight - 4;
    const cw = Math.max(200, wrapW);
    const ch = Math.max(160, Math.min(wrapH, 300));
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    const data = computeChartData(deck, idx);
    
    if (chartAnimId) { cancelAnimationFrame(chartAnimId); chartAnimId = null; }
    
    if (!animate) {
        drawChart(ctx, data, 1, cw, ch, idx);
        return;
    }
    
    chartAnimStart = performance.now();
    const duration = 700;
    
    function frame(time) {
        const t = Math.min((time - chartAnimStart) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        
        const ctx2 = canvas.getContext('2d');
        ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawChart(ctx2, data, ease, cw, ch, idx);
        
        if (t < 1) { chartAnimId = requestAnimationFrame(frame); }
        else { chartAnimId = null; }
    }
    chartAnimId = requestAnimationFrame(frame);
}

function renderStatsPanel() {
    const wrapper = document.getElementById('deck-list-wrapper');
    if (!wrapper) return;
    const deck = decks[currentDeckIndex];
    if (!deck) return;
    
    savedDeckListHTML = wrapper.innerHTML;
    wrapper.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'stats-panel';
    
    const stats = getDeckStats(deck);
    
    panel.innerHTML = `
        <div class="stats-header">
            <button class="btn-stats-back" id="btn-stats-back">&larr; List</button>
            <select class="stats-dropdown" id="stats-dropdown">
                ${CHART_DEFS.map((c, i) => `<option value="${i}" ${i === currentChartIdx ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
        </div>
        <div class="stats-chart-wrap">
            <canvas id="stats-canvas"></canvas>
        </div>
        <div class="stats-chart-indicators" id="stats-indicators">
            ${CHART_DEFS.map((c, i) => `<div class="stats-indicator ${i === currentChartIdx ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
        </div>
        <div class="stats-summary">
            <div class="stats-summary-item">
                <span class="stats-summary-value">${stats.total}</span>
                <span class="stats-summary-label">Total Cards</span>
            </div>
            <div class="stats-summary-item">
                <span class="stats-summary-value">${stats.avgCmc}</span>
                <span class="stats-summary-label">Avg CMC</span>
            </div>
            <div class="stats-summary-item">
                <span class="stats-summary-value">${stats.types.Creatures}</span>
                <span class="stats-summary-label">Creatures</span>
            </div>
            <div class="stats-summary-item">
                <span class="stats-summary-value">${stats.types.Lands}</span>
                <span class="stats-summary-label">Lands</span>
            </div>
        </div>
    `;
    
    wrapper.appendChild(panel);
    statsActive = true;
    btnStatsDeck.classList.add('active');
    
    // Wire dropdown
    const dropdown = document.getElementById('stats-dropdown');
    if (dropdown) {
        dropdown.addEventListener('change', () => {
            currentChartIdx = parseInt(dropdown.value, 10);
            updateIndicators(currentChartIdx);
            renderChart(currentChartIdx, true);
        });
    }
    
    // Wire indicators
    document.querySelectorAll('.stats-indicator').forEach(el => {
        el.addEventListener('click', () => {
            currentChartIdx = parseInt(el.dataset.idx, 10);
            dropdown.value = currentChartIdx;
            updateIndicators(currentChartIdx);
            renderChart(currentChartIdx, true);
        });
    });
    
    // Wire back
    const backBtn = document.getElementById('btn-stats-back');
    if (backBtn) backBtn.addEventListener('click', exitStatsView);
    
    // Render initial chart
    requestAnimationFrame(() => renderChart(currentChartIdx, true));
}

function updateIndicators(idx) {
    document.querySelectorAll('.stats-indicator').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.idx, 10) === idx);
    });
}

// Wire stats button
if (btnStatsDeck) {
    btnStatsDeck.onclick = () => {
        if (statsActive) {
            exitStatsView();
        } else {
            renderStatsPanel();
        }
    };
}

const topbarSearchInput = document.getElementById("topbar-search-input");
const triggerTopbarSearch = () => {
    const val = topbarSearchInput.value.trim();
    if (val) {
        window.location.href = `/pages/search.html?q=${encodeURIComponent(val)}`;
    }
};
topbarSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        triggerTopbarSearch();
    }
});
document.getElementById("topbar-search-trigger").addEventListener("click", triggerTopbarSearch);

renderHub();