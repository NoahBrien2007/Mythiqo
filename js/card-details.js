// Keyword mechanics dictionary
const keywordMechanics = {
    "flying": "This creature can't be blocked except by creatures with flying or reach.",
    "haste": "This creature can attack and tap as soon as it comes under your control.",
    "trample": "This creature can deal excess combat damage to the defending player or planeswalker when blocked.",
    "lifelink": "Damage dealt by this creature also causes you to gain that much life.",
    "deathtouch": "Any amount of damage this deals to a creature is enough to destroy it.",
    "vigilance": "Attacking doesn't cause this creature to tap.",
    "first strike": "This creature deals combat damage before creatures without first strike.",
    "double strike": "This creature deals combat damage twice (in the first-strike combat damage step and the regular combat damage step).",
    "reach": "This creature can block creatures with flying.",
    "defender": "This creature can't attack.",
    "indestructible": "Effects that say 'destroy' don't destroy this permanent. A creature with indestructible can't be destroyed by damage.",
    "hexproof": "This permanent can't be the target of spells or abilities your opponents control.",
    "shroud": "This permanent can't be the target of spells or abilities.",
    "menace": "This creature can't be blocked except by two or more creatures.",
    "prowess": "Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.",
    "ward": "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the specified cost.",
    "flash": "You may cast this spell any time you could cast an instant.",
    "enchant": "A keyword utility that defines what type of object or player an Aura card can target.",
    "equip": "Attach this Equipment to target creature. Activate only as a sorcery.",
    "scry": "Look at the top N cards of your library, then put any number of them on the bottom and the rest on top in any order.",
    "cascade": "When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost. Put the rest on the bottom in a random order.",
    "mill": "Put the top N cards of your library into your graveyard.",
    "affinity": "This spell costs {1} less to cast for each permanent of the specified type you control.",
    "convoke": "Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.",
    "delve": "Each card you exile from your graveyard while casting this spell pays for {1}.",
    "dredge": "If you would draw a card, you may instead put exactly N cards from the top of your library into your graveyard. If you do, return this card from your graveyard to your hand. Otherwise, draw a card.",
    "infect": "This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.",
    "landwalk": "This creature can't be blocked as long as defending player controls at least one land of the specified type.",
    "protection": "This permanent can't be targeted, enchanted, equipped, blocked, or damaged by sources of the specified quality.",
    "kicker": "You may pay an additional cost as you cast this spell.",
    "cycling": "Discard this card: Draw a card.",
    "flashback": "You may cast this card from your graveyard for its flashback cost. Then exile it."
};

// Deck Helpers
const loadDecks = () => {
    return JSON.parse(localStorage.getItem("mythiqo_decks")) || [];
};

const saveDecks = (decks) => {
    localStorage.setItem("mythiqo_decks", JSON.stringify(decks));
};

// Create empty deck with card as commander
const createDeckFromCard = (deckName, commanderCard) => {
    const decks = window.CardDetailsShared.loadDecks();
    const newDeck = {
        id: Date.now(),
        name: deckName || "New Deck",
        commander: commanderCard,
        info: `Created from context menu with ${commanderCard.name} as Commander.`,
        labels: "",
        cards: []
    };
    decks.push(newDeck);
    window.CardDetailsShared.saveDecks(decks);
    return newDeck;
};

// Global context menu and modal instances
let globalContextMenu = null;
let globalDetailsModal = null;
let globalTooltip = null;

// Initialize context menu & modal containers
const initCardDetailsShared = () => {
    if (!globalContextMenu) {
        globalContextMenu = document.createElement("div");
        globalContextMenu.className = "custom-context-menu";
        globalContextMenu.style.display = "none";
        document.body.appendChild(globalContextMenu);
    }

    if (!globalDetailsModal) {
        globalDetailsModal = document.createElement("div");
        globalDetailsModal.className = "info-modal-backdrop";
        globalDetailsModal.innerHTML = `
            <div class="info-modal">
                <div class="info-modal-header">
                    <h2 class="info-modal-title" id="info-modal-title">Card Name</h2>
                    <div class="info-modal-close" id="info-modal-close-btn">&times;</div>
                </div>
                <div class="info-modal-content">
                    <div class="info-modal-left">
                        <div class="info-modal-card-wrapper" id="info-modal-card-wrapper"></div>
                        <button class="btn info-modal-btn-flip" id="info-modal-btn-flip" style="display:none;">FLIP CARD</button>
                    </div>
                    <div class="info-modal-right" id="info-modal-right"></div>
                </div>
                <div class="versions-section">
                    <h3 class="versions-title">Prints & Versions</h3>
                    <div class="versions-list-container" id="info-modal-versions"></div>
                </div>
            </div>
        `;
        document.body.appendChild(globalDetailsModal);

        // Close actions
        const closeBtn = globalDetailsModal.querySelector("#info-modal-close-btn");
        closeBtn.onclick = () => {
            globalDetailsModal.classList.remove("active");
        };
        globalDetailsModal.onclick = (e) => {
            if (e.target === globalDetailsModal) {
                globalDetailsModal.classList.remove("active");
            }
        };
    }

    if (!globalTooltip) {
        globalTooltip = document.createElement("div");
        globalTooltip.className = "version-tooltip";
        globalTooltip.style.display = "none";
        document.body.appendChild(globalTooltip);
    }

    // Dismiss context menu on left click anywhere
    document.addEventListener("click", (e) => {
        if (globalContextMenu && !globalContextMenu.contains(e.target)) {
            globalContextMenu.style.display = "none";
        }
    });

    // Dismiss context menu on right click anywhere else
    document.addEventListener("contextmenu", (e) => {
        if (globalContextMenu && !e.target.closest(".card") && !e.target.closest(".deck-list-item") && !globalContextMenu.contains(e.target)) {
            globalContextMenu.style.display = "none";
        }
    });

    // Dismiss context menu on key Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (globalContextMenu) globalContextMenu.style.display = "none";
            if (globalDetailsModal) globalDetailsModal.classList.remove("active");
        }
    });
};

// Mana Font symbol alias map — maps raw MTG symbol strings to mana-font CSS class suffixes
const SYMBOL_ALIAS = {
    "t": "tap",       // {T} = tap symbol
    "q": "untap",     // {Q} = untap symbol
    "s": "snow",      // {S} = snow mana
    "e": "e",         // {E} = energy counter (ms-e exists)
    "c": "c",         // {C} = colorless
    "x": "x",
    "y": "y",
    "z": "z",
    "p": "p",         // Phyrexian generic
    "wp": "wp",       // {W/P} Phyrexian white
    "up": "up",
    "rp": "rp",
    "gp": "gp",
    "bp": "bp",
    "wu": "wu",       // hybrid {W/U}
    "ub": "ub",
    "br": "br",
    "rg": "rg",
    "gw": "gw",
    "wb": "wb",
    "ur": "ur",
    "bg": "bg",
    "rw": "rw",
    "gu": "gu",
    "bw": "bw",       // extras
    "2w": "2w",       // {2/W} twobrid
    "2u": "2u",
    "2b": "2b",
    "2r": "2r",
    "2g": "2g",
};

// Normalize a raw symbol token to a mana-font class suffix
const normalizeSymbol = (raw) => {
    // Lowercase, strip slashes (e.g. "W/U" -> "wu", "2/W" -> "2w")
    const cleaned = raw.toLowerCase().replace(/\//g, "");
    return SYMBOL_ALIAS[cleaned] !== undefined ? SYMBOL_ALIAS[cleaned] : cleaned;
};

// Parse Mana Cost text into Mana Font elements
const parseManaCost = (manaCost) => {
    if (!manaCost) return "";
    const regex = /{([^}]+)}/g;
    let match;
    let html = "";
    while ((match = regex.exec(manaCost)) !== null) {
        const symbol = normalizeSymbol(match[1]);
        html += `<i class="ms ms-${symbol} ms-cost"></i>`;
    }
    return html;
};

// Replace bracketed symbols in text (e.g. {T}, {R}, {2}) with Mana Font elements
const replaceSymbolsInText = (text) => {
    if (!text) return "";
    return text.replace(/{([^}]+)}/g, (match, symbol) => {
        const cls = normalizeSymbol(symbol);
        return `<i class="ms ms-${cls} ms-cost" style="font-size: 0.95em; vertical-align: middle; margin: 0 1px;"></i>`;
    });
};

// Create HTML for a 3D flip card
const createFlipCardHTML = (cardData, isFlippedByDefault = false) => {
    const hasFaces = cardData.card_faces && cardData.card_faces.length >= 2;
    
    // Front face
    let frontImgUrl = "";
    if (cardData.image_uris && cardData.image_uris.normal) {
        frontImgUrl = cardData.image_uris.normal;
    } else if (hasFaces && cardData.card_faces[0].image_uris && cardData.card_faces[0].image_uris.normal) {
        frontImgUrl = cardData.card_faces[0].image_uris.normal;
    }

    // Back face
    let backImgUrl = "https://gamepedia.cursecdn.com/mtgsalvation_gamepedia/f/f8/Magic_card_back.jpg";
    if (hasFaces && cardData.card_faces[1].image_uris && cardData.card_faces[1].image_uris.normal) {
        backImgUrl = cardData.card_faces[1].image_uris.normal;
    }

    const flippedClass = isFlippedByDefault ? "flipped" : "";

    return `
        <div class="card-flip-container">
            <div class="card-flip-inner ${flippedClass}">
                <div class="card-flip-front">
                    <img src="${frontImgUrl}" alt="${cardData.name}" loading="lazy">
                </div>
                <div class="card-flip-back">
                    <img src="${backImgUrl}" alt="${cardData.name} Back" loading="lazy">
                </div>
            </div>
        </div>
    `;
};

// Setup 3D Flip capability on an element
const toggleCardFlip = (cardElement) => {
    const inner = cardElement.querySelector(".card-flip-inner");
    if (inner) {
        inner.classList.toggle("flipped");
    }
};

// Show Mechanics Modal/Popup
const showMechanicsPopup = (cardData) => {
    // Find keywords
    const keywords = cardData.keywords || [];
    let contentHTML = "";

    if (keywords.length === 0) {
        contentHTML = `
            <div class="info-section">
                <span class="info-section-title">Card Mechanics</span>
                <p style="color: #ccc; font-size: 14px;">No keyword mechanics found on this card.</p>
            </div>
        `;
    } else {
        contentHTML = `
            <div class="info-section">
                <span class="info-section-title">Card Mechanics (${keywords.length})</span>
                <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 10px;">
                    ${keywords.map(kw => {
                        const kwLower = kw.toLowerCase();
                        const desc = keywordMechanics[kwLower] || "A keyword ability or keyword action. Check standard MTG rules details.";
                        return `
                            <div>
                                <strong style="color: var(--green1); text-transform: capitalize; font-size: 15px;">${kw}</strong>
                                <p style="color: #ddd; margin: 4px 0 0 0; font-size: 13px; line-height: 1.5;">${desc}</p>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }

    // Open in a quick mechanics modal
    const mechModal = document.createElement("div");
    mechModal.className = "info-modal-backdrop active";
    mechModal.style.zIndex = 10005; // Above other modals
    mechModal.innerHTML = `
        <div class="info-modal" style="max-width: 500px; height: auto; max-height: 70vh;">
            <div class="info-modal-header">
                <h2 class="info-modal-title" style="font-size: 18px;">Mechanics Viewer</h2>
                <div class="info-modal-close" onclick="this.closest('.info-modal-backdrop').remove()">&times;</div>
            </div>
            <div style="padding: 24px; overflow-y: auto;">
                ${contentHTML}
            </div>
        </div>
    `;
    document.body.appendChild(mechModal);

    // Close on background click
    mechModal.onclick = (e) => {
        if (e.target === mechModal) mechModal.remove();
    };
};

// Render Detailed Modal with Versions
const openDetailedModal = async (cardData) => {
    initCardDetailsShared();
    globalDetailsModal.classList.add("active");

    const renderCardFaceDetails = (card) => {
        const titleEl = globalDetailsModal.querySelector("#info-modal-title");
        const cardWrapper = globalDetailsModal.querySelector("#info-modal-card-wrapper");
        const rightCol = globalDetailsModal.querySelector("#info-modal-right");
        const flipBtn = globalDetailsModal.querySelector("#info-modal-btn-flip");

        // Set title and mana cost
        const manaCostHTML = parseManaCost(card.mana_cost || (card.card_faces ? card.card_faces[0].mana_cost : ""));
        titleEl.innerHTML = `${card.name} <span class="info-modal-mana">${manaCostHTML}</span>`;

        // Set card flip content
        cardWrapper.innerHTML = createFlipCardHTML(card);
        const flipInner = cardWrapper.querySelector(".card-flip-inner");

        // Handle flip button visibility (either has double faces, or allow flipping to show card back)
        const hasDoubleFace = card.card_faces && card.card_faces.length >= 2;
        flipBtn.style.display = "block"; // Always show flip card button for immersion!
        flipBtn.onclick = () => {
            flipInner.classList.toggle("flipped");
        };

        // Render right column details
        let statsHTML = "";
        if (card.power && card.toughness) {
            statsHTML = `<div class="info-stats-pill">${card.power} / ${card.toughness}</div>`;
        } else if (card.loyalty) {
            statsHTML = `<div class="info-stats-pill">Loyalty: ${card.loyalty}</div>`;
        } else if (card.card_faces && card.card_faces[0].power && card.card_faces[0].toughness) {
            statsHTML = `<div class="info-stats-pill">${card.card_faces[0].power} / ${card.card_faces[0].toughness}</div>`;
        } else if (card.card_faces && card.card_faces[0].loyalty) {
            statsHTML = `<div class="info-stats-pill">Loyalty: ${card.card_faces[0].loyalty}</div>`;
        }

        // Gather oracle text
        let oracleHTML = "";
        if (card.oracle_text) {
            oracleHTML = `<div class="info-oracle-text">${replaceSymbolsInText(card.oracle_text)}</div>`;
        } else if (card.card_faces) {
            oracleHTML = card.card_faces.map((face, index) => `
                <div style="margin-bottom: 10px;">
                    <strong style="color: var(--green2);">${face.name}</strong>
                    <div class="info-oracle-text" style="margin-top: 4px;">${replaceSymbolsInText(face.oracle_text) || "No rule text."}</div>
                </div>
            `).join("");
        } else {
            oracleHTML = `<div class="info-oracle-text" style="font-style: italic; color: #888;">No text rules.</div>`;
        }

        // Flavor text
        let flavorHTML = "";
        if (card.flavor_text) {
            flavorHTML = `<div class="info-flavor-text">"${card.flavor_text}"</div>`;
        } else if (card.card_faces && card.card_faces[0].flavor_text) {
            flavorHTML = `<div class="info-flavor-text">"${card.card_faces[0].flavor_text}"</div>`;
        }

        // Prices list
        const p = card.prices || {};
        const pricesHTML = `
            <div class="prices-list">
                <div class="price-tag">USD: <span class="price-val">${p.usd ? "$" + p.usd : "N/A"}</span></div>
                <div class="price-tag">Foil: <span class="price-val">${p.usd_foil ? "$" + p.usd_foil : "N/A"}</span></div>
                <div class="price-tag">EUR: <span class="price-val">${p.eur ? "€" + p.eur : "N/A"}</span></div>
                <div class="price-tag">TIX: <span class="price-val">${p.tix ? p.tix : "N/A"}</span></div>
            </div>
        `;

        // Legality items
        const leg = card.legalities || {};
        const formats = ["standard", "pioneer", "modern", "legacy", "commander", "pauper", "vintage", "historic"];
        const legalityItemsHTML = formats.map(f => {
            const status = leg[f] || "not_legal";
            let statusLabel = status.replace("_", " ");
            return `
                <div class="legality-item">
                    <span>${f}</span>
                    <span class="legality-badge ${status}">${statusLabel}</span>
                </div>
            `;
        }).join("");

        rightCol.innerHTML = `
            <div class="info-section">
                <span class="info-section-title">Type Line</span>
                <div class="info-type-line">${card.type_line}</div>
            </div>

            <div class="info-section">
                <span class="info-section-title">Oracle Text</span>
                ${oracleHTML}
            </div>

            ${flavorHTML ? `
            <div class="info-section">
                <span class="info-section-title">Flavor Text</span>
                ${flavorHTML}
            </div>` : ""}

            <div class="info-section">
                <span class="info-section-title">Details</span>
                <div class="info-details-grid">
                    <div class="info-detail-item">
                        <span class="info-detail-label">Mana Value (CMC)</span>
                        <span class="info-detail-value">${card.cmc !== undefined ? card.cmc : "0"}</span>
                    </div>
                    <div class="info-detail-item">
                        <span class="info-detail-label">Rarity</span>
                        <span class="info-detail-value rarity-${card.rarity}">${card.rarity}</span>
                    </div>
                    <div class="info-detail-item">
                        <span class="info-detail-label">Set</span>
                        <span class="info-detail-value" style="text-transform: uppercase;">${card.set_name} (${card.set})</span>
                    </div>
                    <div class="info-detail-item">
                        <span class="info-detail-label">Collector No.</span>
                        <span class="info-detail-value">#${card.collector_number}</span>
                    </div>
                    <div class="info-detail-item" style="grid-column: span 2;">
                        <span class="info-detail-label">Artist</span>
                        <span class="info-detail-value">${card.artist || "Unknown Artist"}</span>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <span class="info-section-title">Prices</span>
                ${pricesHTML}
            </div>

            <div class="info-section">
                <span class="info-section-title">Legalities</span>
                <div class="legality-grid">
                    ${legalityItemsHTML}
                </div>
            </div>

            ${statsHTML}
        `;
    };

    // Render primary card face details
    renderCardFaceDetails(cardData);

    // Fetch card prints
    const versionsContainer = globalDetailsModal.querySelector("#info-modal-versions");
    versionsContainer.innerHTML = '<div class="loader" style="width: 24px; height: 24px; margin: 10px auto;"></div>';

    try {
        let printsUrl = cardData.prints_search_uri;
        if (!printsUrl && cardData.oracle_id) {
            printsUrl = `https://api.scryfall.com/cards/search?order=released&q=oracleid%3A${cardData.oracle_id}&unique=prints`;
        }

        if (printsUrl) {
            const res = await fetch(printsUrl);
            if (res.ok) {
                const data = await res.json();
                const prints = data.data || [];
                versionsContainer.innerHTML = "";

                prints.forEach(printCard => {
                    const printImgUrl = printCard.image_uris ? printCard.image_uris.small : (printCard.card_faces ? printCard.card_faces[0].image_uris.small : "");
                    if (!printImgUrl) return;

                    const thumb = document.createElement("div");
                    thumb.className = `version-thumbnail ${printCard.id === cardData.id ? "active" : ""}`;
                    thumb.innerHTML = `<img src="${printImgUrl}" alt="${printCard.set}">`;

                    // Left click to switch current view in modal
                    thumb.onclick = () => {
                        versionsContainer.querySelectorAll(".version-thumbnail").forEach(t => t.classList.remove("active"));
                        thumb.classList.add("active");
                        renderCardFaceDetails(printCard);
                    };

                    // Right click version thumbnail!
                    thumb.addEventListener("contextmenu", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Open a custom context menu for this specific printed version
                        showContextMenu(e, printCard, {
                            onUpdate: () => {
                                // If they added to deck, etc.
                            }
                        });
                    });

                    // Tooltip details on hover
                    thumb.onmouseenter = (e) => {
                        const rect = thumb.getBoundingClientRect();
                        globalTooltip.innerHTML = `
                            <span class="version-tooltip-set">${printCard.set_name} (${printCard.set.toUpperCase()})</span>
                            <span>No. #${printCard.collector_number} • ${printCard.rarity}</span>
                            <span>Released: ${printCard.released_at}</span>
                            <span style="color: var(--green2);">USD: ${printCard.prices.usd ? "$" + printCard.prices.usd : "N/A"}</span>
                        `;
                        globalTooltip.style.display = "flex";
                        globalTooltip.style.left = `${rect.left + window.scrollX}px`;
                        globalTooltip.style.top = `${rect.top - globalTooltip.offsetHeight - 6 + window.scrollY}px`;
                    };

                    thumb.onmouseleave = () => {
                        globalTooltip.style.display = "none";
                    };

                    versionsContainer.appendChild(thumb);
                });
            } else {
                versionsContainer.innerHTML = '<span style="color: #666; font-size: 12px;">Could not load printing versions.</span>';
            }
        } else {
            versionsContainer.innerHTML = '<span style="color: #666; font-size: 12px;">No prints URI available.</span>';
        }
    } catch (e) {
        versionsContainer.innerHTML = '<span style="color: #666; font-size: 12px;">Error fetching versions.</span>';
    }
};

// Show Dynamic Context Menu
const showContextMenu = (e, cardData, options = {}) => {
    initCardDetailsShared();

    const inDeck = options.inDeck || false;
    const deckId = options.deckId || null;
    const onUpdate = options.onUpdate || null;

    let decks = window.CardDetailsShared.loadDecks();

    let deckSubmenuHTML = "";
    if (decks.length === 0) {
        deckSubmenuHTML = `
            <div class="context-item" id="ctx-create-deck-first">+ Create New Deck...</div>
        `;
    } else {
        deckSubmenuHTML = decks.map(d => `
            <div class="context-item ctx-add-to-deck-item" data-deck-id="${d.id}">${d.name}</div>
        `).join("") + `
            <div style="border-top: 1px solid var(--green4); margin: 4px 0;"></div>
            <div class="context-item" id="ctx-create-deck-new">+ Create New Deck...</div>
        `;
    }

    globalContextMenu.innerHTML = `
        <div class="context-item" id="ctx-show-info">Show Info</div>
        <div class="context-item" id="ctx-show-mechanics">Show Mechanics</div>
        <div class="context-item" id="ctx-flip-card">Flip Card</div>
        ${inDeck ? `<div class="context-item" id="ctx-remove-deck" style="color: #ff7777;">Remove from Deck</div>` : ""}
        <div class="context-item has-submenu" id="ctx-add-deck-menu">
            Add to Deck
            <div class="context-submenu">
                ${deckSubmenuHTML}
            </div>
        </div>
    `;

    // Position menu
    globalContextMenu.style.display = "block";
    globalContextMenu.style.opacity = "0";
    
    // Perform boundary checks
    const menuWidth = globalContextMenu.offsetWidth;
    const menuHeight = globalContextMenu.offsetHeight;
    const clickX = e.clientX;
    const clickY = e.clientY;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = clickX;
    let posY = clickY;

    if (clickX + menuWidth > windowWidth) {
        posX = windowWidth - menuWidth - 6;
    }
    if (clickY + menuHeight > windowHeight) {
        posY = windowHeight - menuHeight - 6;
    }

    globalContextMenu.style.left = `${posX}px`;
    globalContextMenu.style.top = `${posY}px`;
    globalContextMenu.style.opacity = "1";

    // Bind item click behaviors
    globalContextMenu.querySelector("#ctx-show-info").onclick = () => {
        globalContextMenu.style.display = "none";
        openDetailedModal(cardData);
    };

    globalContextMenu.querySelector("#ctx-show-mechanics").onclick = () => {
        globalContextMenu.style.display = "none";
        showMechanicsPopup(cardData);
    };

    globalContextMenu.querySelector("#ctx-flip-card").onclick = () => {
        globalContextMenu.style.display = "none";
        // Attempt to find the card flip container relative to the right-clicked target
        if (e.target) {
            const cardEl = e.target.closest(".card") || e.target.closest(".card-flip-container");
            if (cardEl) {
                toggleCardFlip(cardEl);
            }
        }
    };

    if (inDeck) {
        globalContextMenu.querySelector("#ctx-remove-deck").onclick = () => {
            globalContextMenu.style.display = "none";
            const decks = window.CardDetailsShared.loadDecks();
            const deck = decks.find(d => d.id == deckId);
            if (deck) {
                const index = deck.cards.findIndex(c => c.id === cardData.id);
                if (index !== -1) {
                    deck.cards.splice(index, 1);
                    window.CardDetailsShared.saveDecks(decks);
                    if (onUpdate) onUpdate();
                }
            }
        };
    }

    // Add to deck listeners
    globalContextMenu.querySelectorAll(".ctx-add-to-deck-item").forEach(item => {
        item.onclick = () => {
            globalContextMenu.style.display = "none";
            const targetDeckId = item.getAttribute("data-deck-id");
            const decks = window.CardDetailsShared.loadDecks();
            const deck = decks.find(d => d.id == targetDeckId);
            if (deck) {
                deck.cards.push(cardData);
                window.CardDetailsShared.saveDecks(decks);
                alert(`Added ${cardData.name} to ${deck.name}!`);
                if (onUpdate) onUpdate();
            }
        };
    });

    const triggerCreateDeckFlow = () => {
        globalContextMenu.style.display = "none";
        const name = prompt("Enter new deck name:", `${cardData.name} Commander Deck`);
        if (name === null) return;
        const newD = createDeckFromCard(name, cardData);
        alert(`Created deck "${newD.name}" with ${cardData.name} as Commander!`);
        if (onUpdate) onUpdate();
    };

    const firstCreateBtn = globalContextMenu.querySelector("#ctx-create-deck-first");
    const newCreateBtn = globalContextMenu.querySelector("#ctx-create-deck-new");
    if (firstCreateBtn) firstCreateBtn.onclick = triggerCreateDeckFlow;
    if (newCreateBtn) newCreateBtn.onclick = triggerCreateDeckFlow;
};

// ─── Deck Import / Export ───────────────────────────────────────────────────

/**
 * Trigger a JSON download of a deck object.
 * @param {object} deck
 */
const exportDeck = (deck) => {
    // Generate Moxfield-compatible plain text format
    let text = "Commander\n";
    text += `1 ${deck.commander.name}\n\n`;
    text += "Deck\n";
    
    // Group deck cards by name
    const counts = {};
    deck.cards.forEach(card => {
        counts[card.name] = (counts[card.name] || 0) + 1;
    });
    
    for (const [name, count] of Object.entries(counts)) {
        text += `${count} ${name}\n`;
    }
    
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name.replace(/\s+/g, "_")}_decklist.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Read a JSON file from an <input type="file"> change event and import the deck.
 * Returns a Promise that resolves to the imported deck or rejects with an error message.
 * @param {File} file
 * @returns {Promise<object>}
 */
const importDeck = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject("Please select a valid file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const content = evt.target.result;
            try {
                // Try parsing as JSON first
                if (file.name.endsWith(".json")) {
                    const deck = JSON.parse(content);
                    if (!deck.id || !deck.name || !deck.commander || !Array.isArray(deck.cards)) {
                        reject("Invalid deck file - missing required fields.");
                        return;
                    }
                    const decks = window.CardDetailsShared.loadDecks();
                    const existing = decks.findIndex(d => d.id === deck.id);
                    if (existing !== -1) {
                        decks[existing] = deck;
                    } else {
                        decks.push(deck);
                    }
                    window.CardDetailsShared.saveDecks(decks);
                    resolve(deck);
                    return;
                }
                
                // Otherwise, parse as Moxfield plain text list
                const lines = content.split(/\r?\n/);
                let commanderName = "";
                const deckCardNames = [];
                let section = "";
                
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    const lower = line.toLowerCase();
                    if (lower === "commander") {
                        section = "commander";
                        continue;
                    } else if (lower === "deck") {
                        section = "deck";
                        continue;
                    }
                    
                    let cleanLine = line.replace(/\([^)]+\)/g, "").replace(/\*[^*]+\*/g, "").trim();
                    const match = cleanLine.match(/^(\d+)\s+(.+)$/);
                    if (match) {
                        const qty = parseInt(match[1], 10);
                        const cardName = match[2].trim();
                        
                        if (section === "commander") {
                            commanderName = cardName;
                        } else {
                            for (let i = 0; i < qty; i++) {
                                deckCardNames.push(cardName);
                            }
                        }
                    } else {
                        if (section === "commander") {
                            commanderName = cleanLine;
                        } else {
                            deckCardNames.push(cleanLine);
                        }
                    }
                }
                
                if (!commanderName) {
                    reject("Could not find a Commander in the text file.");
                    return;
                }
                
                const cmdRes = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`);
                if (!cmdRes.ok) {
                    reject("Could not find Commander on Scryfall.");
                    return;
                }
                const commanderCard = await cmdRes.json();
                
                const deckCards = [];
                const uniqueNames = Array.from(new Set(deckCardNames));
                const nameToCardMap = {};
                
                for (let i = 0; i < uniqueNames.length; i += 75) {
                    const chunk = uniqueNames.slice(i, i + 75);
                    const identifiers = chunk.map(name => ({ name }));
                    
                    const colRes = await fetch("https://api.scryfall.com/cards/collection", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ identifiers })
                    });
                    
                    if (colRes.ok) {
                           const colData = await colRes.json();
                           if (colData.data) {
                               colData.data.forEach(card => {
                                   if (card && card.name) {
                                       nameToCardMap[card.name.toLowerCase()] = card;
                                   }
                               });
                           }
                    }
                }
                
                deckCardNames.forEach(name => {
                    const found = nameToCardMap[name.toLowerCase()];
                    if (found) {
                        deckCards.push(found);
                    } else {
                        deckCards.push({
                            name: name,
                            type_line: "Unknown Type",
                            oracle_text: "Details not loaded.",
                            image_uris: { normal: "https://gamepedia.cursecdn.com/mtgsalvation_gamepedia/f/f8/Magic_card_back.jpg" }
                        });
                    }
                });
                
                const newDeck = {
                    id: Date.now(),
                    name: file.name.replace(/\.[^/.]+$/, "").replace(/_decklist/i, "").replace(/_+/g, " "),
                    commander: commanderCard,
                    info: "Imported from Moxfield text format.",
                    labels: "Imported",
                    cards: deckCards
                };
                
                const decks = window.CardDetailsShared.loadDecks();
                decks.push(newDeck);
                window.CardDetailsShared.saveDecks(decks);
                resolve(newDeck);
                
            } catch (e) {
                reject("Error parsing deck file: " + e.message);
            }
        };
        reader.onerror = () => reject("Error reading file.");
        reader.readAsText(file);
    });
};

// Basic land names that can have more than 1 copy in Commander
const BASIC_LAND_NAMES = new Set([
    "Plains", "Island", "Swamp", "Mountain", "Forest",
    "Wastes", "Snow-Covered Plains", "Snow-Covered Island",
    "Snow-Covered Swamp", "Snow-Covered Mountain", "Snow-Covered Forest"
]);

/**
 * Validate a Commander deck and return an array of warning objects.
 * Each object: { level: "error"|"warn"|"ok", message: string }
 * @param {object} deck
 * @returns {Array<{level: string, message: string}>}
 */
const validateDeck = (deck) => {
    const warnings = [];
    if (!deck) return warnings;

    const commander = deck.commander;
    const cards = deck.cards || [];

    // Total count = commander (1) + deck.cards
    const totalCount = 1 + cards.length;
    if (totalCount < 100) {
        warnings.push({ level: "warn", message: `<strong>Deck</strong> has ${totalCount}/100 cards - needs ${100 - totalCount} <strong>more</strong>.` });
    } else if (totalCount > 100) {
        warnings.push({ level: "warn", message: `<strong>Deck</strong> has ${totalCount}/100 cards - ${totalCount - 100} <strong>too many</strong>.` });
    } else {
        warnings.push({ level: "ok", message: "<strong>Deck</strong> is <strong>exactly 100 cards</strong>." });
    }

    // Commander legality check
    if (commander) {
        const typeLine = (commander.type_line || "").toLowerCase();
        const isLegendary = typeLine.includes("legendary");
        const isCreatureOrPW = typeLine.includes("creature") || typeLine.includes("planeswalker");
        const cmdLegality = commander.legalities && commander.legalities.commander;

        if (!isLegendary || !isCreatureOrPW) {
            warnings.push({ level: "error", message: `<strong>Commander</strong> <strong>"${commander.name}"</strong> must be a <strong>Legendary Creature</strong> or <strong>Planeswalker</strong>.` });
        }
        if (cmdLegality && cmdLegality !== "legal") {
            warnings.push({ level: "error", message: `<strong>Commander</strong> <strong>"${commander.name}"</strong> is <strong>not legal</strong> in Commander format.` });
        }
    }

    // Helper: cards that explicitly allow multiple copies (e.g. Relentless Rats, Shadowborn Apostle)
    const allowsMultipleCopies = (card) => {
        const text = (card.oracle_text || "").toLowerCase();
        if (text.includes("a deck can have any number")) return true;
        if (Array.isArray(card.card_faces)) {
            return card.card_faces.some(face => (face.oracle_text || "").toLowerCase().includes("a deck can have any number"));
        }
        return false;
    };

    // Color identity check - flag cards whose colors are outside the commander's identity
    if (commander && Array.isArray(commander.color_identity)) {
        const cmdColors = new Set(commander.color_identity.map(c => c.toUpperCase()));
        const seenColorViolations = new Set();
        cards.forEach(card => {
            if (!card || !card.name || !Array.isArray(card.color_identity)) return;
            const cardKey = card.oracle_id || card.name;
            if (seenColorViolations.has(cardKey)) return;
            const offColors = card.color_identity.filter(c => !cmdColors.has(c.toUpperCase()));
            if (offColors.length > 0) {
                seenColorViolations.add(cardKey);
                warnings.push({
                    level: "error",
                    message: `<strong>"${card.name}"</strong> <strong>color identity does not match</strong> the commander's color identity.`
                });
            }
        });
    }

    // Singleton check - group by oracle_id (or name)
    const seen = {};
    cards.forEach(card => {
        if (!card || !card.name) return;
        if (BASIC_LAND_NAMES.has(card.name)) return; // Basic lands exempt
        if (allowsMultipleCopies(card)) return;       // Cards like Relentless Rats exempt
        const key = card.oracle_id || card.name;
        seen[key] = (seen[key] || { card, count: 0 });
        seen[key].count++;
    });

    // Also check commander is not duplicated in deck
    const cmdKey = commander ? (commander.oracle_id || commander.name) : null;
    if (cmdKey && seen[cmdKey]) {
        warnings.push({ level: "error", message: `<strong>"${commander.name}"</strong> appears in the deck AND as <strong>Commander</strong> - <strong>remove duplicate</strong>.` });
    }

    const duplicates = Object.values(seen).filter(e => e.count > 1);
    duplicates.forEach(({ card, count }) => {
        warnings.push({ level: "warn", message: `<strong>"${card.name}"</strong> appears ${count}x - <strong>only 1 copy</strong> is allowed.` });
    });

    return warnings;
};

// ─── Exports ────────────────────────────────────────────────────────────────

// Export these functions to the window object for easy page script integration
window.CardDetailsShared = {
    init: initCardDetailsShared,
    parseManaCost: parseManaCost,
    replaceSymbolsInText: replaceSymbolsInText,
    createFlipCardHTML: createFlipCardHTML,
    toggleCardFlip: toggleCardFlip,
    showContextMenu: showContextMenu,
    openDetailedModal: openDetailedModal,
    showMechanicsPopup: showMechanicsPopup,
    loadDecks: loadDecks,
    saveDecks: saveDecks,
    createDeckFromCard: createDeckFromCard,
    exportDeck: exportDeck,
    importDeck: importDeck,
    validateDeck: validateDeck,
    BASIC_LAND_NAMES: BASIC_LAND_NAMES
};
