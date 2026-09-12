if (self === top) {
    var antiClickjack = document.getElementById("antiClickjack");
    if (antiClickjack) {
        antiClickjack.parentNode.removeChild(antiClickjack);
    }
} else {
    top.location = self.location;
}
