const button = document.getElementById("cardButton");
const message = document.getElementById("message");

button.addEventListener("click", () => {
    message.textContent = "Black Lotus Revealed!";
});