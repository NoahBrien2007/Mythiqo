const bg = document.getElementById('mana-bg');
const colors = ['w', 'u', 'b', 'r', 'g'];
let bgHTML = '';

for (let i = 0; i < 50; i++) {
    let columnHTML = '<div class="mana-column"><div class="mana-column-inner">';
    const offset = (i * 2) % colors.length;
    let symbols = '';
    for (let j = 0; j < 15; j++) {
        const color = colors[(offset + j) % colors.length];
        symbols += `<i class="ms ms-${color} ms-cost" style="font-size: 20px;"></i>`;
    }
    columnHTML += symbols + symbols;
    columnHTML += '</div></div>';
    bgHTML += columnHTML;
}
bg.innerHTML = bgHTML;

const allSymbols = document.querySelectorAll('.mana-column-inner i');
let mouseX = -1000;
let mouseY = -1000;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

document.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
});

function animateRepulsion() {
    allSymbols.forEach(symbol => {
        const rect = symbol.getBoundingClientRect();
        const symbolX = rect.left + rect.width / 2;
        const symbolY = rect.top + rect.height / 2;
        const dx = symbolX - mouseX;
        const dy = symbolY - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 1000;

        if (distance < maxDistance) {
            const force = (maxDistance - distance) / maxDistance;
            const pushX = (dx / distance) * force * 50;
            const pushY = (dy / distance) * force * 50;
            symbol.style.transform = `translate(${pushX}px, ${pushY}px) scale(1)`;
        } else {
            symbol.style.transform = 'translate(0px, 0px) scale(1)';
        }
    });
    requestAnimationFrame(animateRepulsion);
}
animateRepulsion();

const searchInput = document.getElementById('search-input');
const triggerSearch = () => {
    const val = searchInput.value.trim();
    if (val) {
        window.location.href = `/pages/search.html?q=${encodeURIComponent(val)}`;
    }
};

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        triggerSearch();
    }
});

document.getElementById('search-trigger').addEventListener('click', triggerSearch);