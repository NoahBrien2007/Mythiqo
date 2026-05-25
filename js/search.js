const filtersToggle = document.getElementById("filters-toggle");
const filters = document.getElementById("filters");
const manaFilters = document.querySelectorAll(".mana-btn");
const selectBtn = document.querySelector(".select-btn");
const selectMenu = document.querySelector(".select-menu");
const selectOptions = document.querySelectorAll(".select-option");
const container = document.querySelector(".card-container");
const searchInput = document.getElementById("search-input");
const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebar-close");
const sidebarImg = document.getElementById("sidebar-img");
const sidebarTitle = document.getElementById("sidebar-title");
const sidebarType = document.getElementById("sidebar-type");
const sidebarText = document.getElementById("sidebar-text");
const sidebarStats = document.getElementById("sidebar-stats");

const fetchCards = async () => {
    const text = searchInput.value.trim();
    const activeMana = Array.from(document.querySelectorAll(".mana-btn.active")).map(btn => {
        if (btn.classList.contains("ms-w")) return "w";
        if (btn.classList.contains("ms-u")) return "u";
        if (btn.classList.contains("ms-b")) return "b";
        if (btn.classList.contains("ms-r")) return "r";
        if (btn.classList.contains("ms-g")) return "g";
    }).join("");

    const selectText = selectBtn.firstChild.textContent.trim();
    let colorOperator = ":";

    if (selectText === "EXACTLY THESE COLORS") colorOperator = "=";
    else if (selectText === "INCLUDING THESE COLORS") colorOperator = ">=";
    else if (selectText === "AT MOST THESE COLORS") colorOperator = "<=";

    let query = [];
    if (text) query.push(text);
    if (activeMana) query.push(`c${colorOperator}${activeMana}`);

    const finalQuery = query.join(" ");

    if (!finalQuery) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = '<div class="loader"></div>';

    try {
        const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(finalQuery)}`);
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

        const imgUrl = cardData.image_uris ? cardData.image_uris.normal : cardData.card_faces[0].image_uris.normal;
        const img = document.createElement("img");
        img.src = imgUrl;
        card.appendChild(img);

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

        container.appendChild(card);
    });
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

selectBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    selectMenu.classList.toggle("active");
    selectBtn.classList.toggle("active");
});

selectOptions.forEach((option) => {
    option.addEventListener("click", () => {
        selectBtn.firstChild.textContent = option.textContent;
        selectMenu.classList.remove("active");
        selectBtn.classList.remove("active");
    });
});

document.addEventListener("click", (e) => {
    if (!selectBtn.contains(e.target) && !selectMenu.contains(e.target)) {
        selectMenu.classList.remove("active");
        selectBtn.classList.remove("active");
    }
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