const filtersToggle = document.getElementById("filters-toggle");
const filters = document.getElementById("filters");
const manaFilters = document.querySelectorAll(".mana-btn");
const container = document.querySelector(".card-container");
const searchInput = document.getElementById("search-input");
const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebar-close");
const sidebarImg = document.getElementById("sidebar-img");
const sidebarTitle = document.getElementById("sidebar-title");
const sidebarType = document.getElementById("sidebar-type");
const sidebarText = document.getElementById("sidebar-text");
const sidebarStats = document.getElementById("sidebar-stats");

// Initialize card details shared containers
window.addEventListener("DOMContentLoaded", () => {
    if (window.CardDetailsShared) {
        window.CardDetailsShared.init();
    }
});

// Setup ALL custom selects
document.querySelectorAll(".custom-select").forEach(selectContainer => {
    const btn = selectContainer.querySelector(".select-btn");
    const menu = selectContainer.querySelector(".select-menu");
    const options = selectContainer.querySelectorAll(".select-option");

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".select-menu").forEach(m => {
            if (m !== menu) m.classList.remove("active");
        });
        document.querySelectorAll(".select-btn").forEach(b => {
            if (b !== btn) b.classList.remove("active");
        });
        menu.classList.toggle("active");
        btn.classList.toggle("active");
    });

    options.forEach(opt => {
        opt.addEventListener("click", () => {
            btn.firstChild.textContent = opt.textContent;
            menu.classList.remove("active");
            btn.classList.remove("active");
        });
    });
});

document.addEventListener("click", () => {
    document.querySelectorAll(".select-menu").forEach(m => m.classList.remove("active"));
    document.querySelectorAll(".select-btn").forEach(b => b.classList.remove("active"));
});

const fetchCards = async () => {
    const text = searchInput.value.trim();
    
    // 1. Color filter
    const activeMana = Array.from(document.querySelectorAll(".mana-btn.active")).map(btn => {
        if (btn.classList.contains("ms-w")) return "w";
        if (btn.classList.contains("ms-u")) return "u";
        if (btn.classList.contains("ms-b")) return "b";
        if (btn.classList.contains("ms-r")) return "r";
        if (btn.classList.contains("ms-g")) return "g";
    }).join("");

    const colorOperatorText = document.querySelector("#select-color-operator .select-btn").firstChild.textContent.trim();
    let colorOperator = ":";
    if (colorOperatorText === "EXACTLY THESE COLORS") colorOperator = "=";
    else if (colorOperatorText === "INCLUDING THESE COLORS") colorOperator = ">=";
    else if (colorOperatorText === "AT MOST THESE COLORS") colorOperator = "<=";

    let query = [];
    if (text) query.push(text);
    if (activeMana) query.push(`c${colorOperator}${activeMana}`);

    // 2. Card Type filter
    const typeText = document.querySelector("#select-type .select-btn").firstChild.textContent.trim();
    if (typeText !== "ANY TYPE") {
        query.push(`t:${typeText.toLowerCase()}`);
    }

    // 3. Rarity filter
    const rarityText = document.querySelector("#select-rarity .select-btn").firstChild.textContent.trim();
    if (rarityText !== "ANY RARITY") {
        query.push(`r:${rarityText.toLowerCase()}`);
    }

    // 4. Legality format filter
    const formatText = document.querySelector("#select-format .select-btn").firstChild.textContent.trim();
    if (formatText !== "ANY FORMAT") {
        query.push(`f:${formatText.toLowerCase()}`);
    }

    // 5. CMC (Mana Value) filter
    const cmcOperator = document.querySelector("#select-cmc-operator .select-btn").firstChild.textContent.trim();
    const cmcVal = document.getElementById("cmc-value").value.trim();
    if (cmcVal !== "") {
        query.push(`cmc${cmcOperator}${cmcVal}`);
    }

    const finalQuery = query.join(" ");

    if (!finalQuery) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = '<div class="loader"></div>';

    // 6. Sorting Order & Direction
    const sortByText = document.querySelector("#select-sort .select-btn").firstChild.textContent.trim();
    let order = "name";
    if (sortByText === "CMC") order = "cmc";
    else if (sortByText === "RARITY") order = "rarity";
    else if (sortByText === "RELEASED") order = "released";
    else if (sortByText === "POWER") order = "power";
    else if (sortByText === "TOUGHNESS") order = "toughness";

    const dirText = document.querySelector("#select-dir .select-btn").firstChild.textContent.trim();
    let dir = "auto";
    if (dirText === "ASCENDING") dir = "asc";
    else if (dirText === "DESCENDING") dir = "desc";

    try {
        let apiUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(finalQuery)}`;
        if (order) apiUrl += `&order=${order}`;
        if (dir) apiUrl += `&dir=${dir}`;

        const res = await fetch(apiUrl);
        const data = await res.json();
        renderCards(data.data || []);
    } catch (e) {
        container.innerHTML = "";
    }
};

const renderCards = (cardsData) => {
    container.innerHTML = "";
    cardsData.forEach(cardData => {
        if (!cardData.image_uris && !cardData.card_faces) return;

        const card = document.createElement("div");
        card.className = "card";
        
        // Wrap image inside a 3D flip card structure
        if (window.CardDetailsShared) {
            card.innerHTML = window.CardDetailsShared.createFlipCardHTML(cardData);
        } else {
            const imgUrl = cardData.image_uris ? cardData.image_uris.normal : cardData.card_faces[0].image_uris.normal;
            const img = document.createElement("img");
            img.src = imgUrl;
            card.appendChild(img);
        }

        // Left click toggles sidebar details
        card.onclick = () => {
            const active = card.classList.contains("active");
            document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));

            if (active) {
                container.classList.remove("toggled");
                sidebar.classList.remove("active");
            } else {
                container.classList.add("toggled");
                card.classList.add("active");
                openSidebar(cardData);
            }
        };

        // Right click opens custom context menu
        card.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (window.CardDetailsShared) {
                window.CardDetailsShared.showContextMenu(e, cardData, {
                    inDeck: false
                });
            }
        });

        container.appendChild(card);
    });
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

    // Rich Title with Mana symbols
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
            <div class="sidebar-decks-dropdown" id="sidebar-decks-dropdown" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; background: #0d1a0d; border: 1px solid var(--green3); box-shadow: 0 6px 18px rgba(0,255,0,0.2); z-index: 100; max-height: 220px; overflow-y: auto; border-radius: 0 0 8px 8px;"></div>
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
        const deckList = window.CardDetailsShared ? window.CardDetailsShared.loadDecks() : [];
        sidebarDecksDropdown.innerHTML = "";

        if (deckList.length === 0) {
            // No decks — prompt user to go create one on the Decks page
            const hint = document.createElement("div");
            hint.style.cssText = "padding: 14px 12px; color: #777; font-size: 12px; line-height: 1.5; text-align: center;";
            hint.innerHTML = `No decks yet.<br><a href="deck.html" style="color: var(--green2); text-decoration: underline;">Go to the Decks page</a> to create one.`;
            sidebarDecksDropdown.appendChild(hint);
        } else {
            const header = document.createElement("div");
            header.style.cssText = "padding: 8px 12px; font-size: 10px; letter-spacing: 1px; color: #555; text-transform: uppercase; border-bottom: 1px solid #1a2e1a;";
            header.textContent = "Add to Deck";
            sidebarDecksDropdown.appendChild(header);

            deckList.forEach(d => {
                const item = document.createElement("div");
                item.style.cssText = "padding: 10px 12px; font-size: 13px; cursor: pointer; border-bottom: 1px solid #1a2e1a; color: #ccc; transition: background 0.15s;";
                item.textContent = d.name;
                item.onmouseover = () => { item.style.background = "rgba(0,200,80,0.12)"; item.style.color = "var(--green2)"; };
                item.onmouseout  = () => { item.style.background = "transparent"; item.style.color = "#ccc"; };
                item.onclick = () => {
                    sidebarDecksDropdown.style.display = "none";
                    const currentDecks = window.CardDetailsShared.loadDecks();
                    const targetDeck = currentDecks.find(td => td.id == d.id);
                    if (targetDeck) {
                        targetDeck.cards.push(cardData);
                        window.CardDetailsShared.saveDecks(currentDecks);
                        // Visual confirmation — flash button green briefly
                        sidebarAddBtn.textContent = `✓ Added to ${targetDeck.name}`;
                        sidebarAddBtn.style.background = "var(--green3)";
                        sidebarAddBtn.style.color = "var(--black)";
                        setTimeout(() => {
                            sidebarAddBtn.textContent = "ADD TO DECK";
                            sidebarAddBtn.style.background = "";
                            sidebarAddBtn.style.color = "";
                        }, 1800);
                    }
                };
                sidebarDecksDropdown.appendChild(item);
            });
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
    container.classList.remove("toggled");
};

sidebarClose.onclick = closeSidebar;

filtersToggle.addEventListener("click", () => {
    filters.classList.toggle("active");
    filtersToggle.classList.toggle("active");
});

manaFilters.forEach((manaFilter) => {
    manaFilter.addEventListener("click", () => {
        manaFilter.classList.toggle("active");
    });
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        fetchCards();
    }
});

document.getElementById("search-trigger").addEventListener("click", fetchCards);

window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const queryParam = params.get("q");
    if (queryParam) {
        searchInput.value = queryParam;
        fetchCards();
    }
});