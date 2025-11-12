let count = 0;

const muffinButton = document.getElementById("muffinButton");
const muffinCountDisplay = document.getElementById("muffinCount");

muffinButton.addEventListener("click", function() {
    count++;
    muffinCountDisplay.textContent = count;
})