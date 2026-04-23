const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: "*" },
  path: "/socket.io",
  transports: ["polling"],
});

// 🔢 PERIOD SYSTEM
let period = 100000000000000;
let currentPeriod;

function getNextPeriod() {
  period++;
  return period;
}

// 🎮 GAME LOOP
async function startGame() {

  currentPeriod = getNextPeriod();
  let multiplier = 1.0;
  const crashPoint = Number((Math.random() * 5 + 1).toFixed(2));

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);

  io.emit("working");
  io.emit("prepareplane");

  setTimeout(() => {

    io.emit("flyplane");
io.emit("crash-update", {
  crashpoint: 1.0
});
    let gameInterval = null;

    gameInterval = setInterval(async () => {

      // ✅ safe increment
      multiplier = Number((multiplier + 0.01).toFixed(2));
      if (isNaN(multiplier)) multiplier = 1;

      // 📡 send multiplier
      io.emit("crash-update", {
        crashpoint: multiplier,
      });

      // 💥 crash condition
      if (multiplier >= crashPoint) {

        clearInterval(gameInterval);
        gameInterval = null;

       let safeMultiplier = Number((multiplier + 0.01).toFixed(2));

if (!safeMultiplier || isNaN(safeMultiplier)) {
  safeMultiplier = 1.0;
}

io.emit("crash-update", { crashpoint: finalCrash });

// delay de
setTimeout(() => {
  io.emit("reset");
  io.emit("removecrash");
}, 50);
        // 📊 HISTORY FETCH
        try {
          const res = await axios.get(
            "https://jalwagame5.shop/jet/trova/src/api/bet?action=gethistory"
          );

          if (Array.isArray(res.data)) {
            io.emit("updatehistory", res.data);
          } else {
            console.log("❌ Invalid history format:", res.data);
          }

          console.log("📊 HISTORY UPDATED");

        } catch (err) {
          console.log("❌ HISTORY ERROR:", err.message);
        }

        // 🔄 next round
        setTimeout(startGame, 3000);
      }

    }, 100);

  }, 2000);
}

// 🔌 SOCKET EVENTS
io.on("connection", (socket) => {

  console.log("✅ CONNECTED:", socket.id);

  socket.onAny((event, data) => {
    console.log("📡", event, data);
  });

  // 💰 BET
  socket.on("newBet", async (username, amount) => {

    console.log("💰 BET:", username, amount);

    if (!amount || amount <= 0) return;

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username,
          period: currentPeriod,
          ans: "manual",
          amount,
        })
      );

      console.log("✅ BET RESPONSE:", res.data);

    } catch (err) {
      console.log("❌ BET ERROR:", err.message);
    }
  });

  // 💸 CASHOUT
  socket.on("addWin", async (username, amount, multiplier) => {

    amount = Number(amount);
    multiplier = Number(multiplier);

    if (!amount || amount <= 0) return;

    const fixedMultiplier = Number(multiplier.toFixed(2));
    const fixedAmount = Number(amount.toFixed(2));

    console.log("💸 CASHOUT:", username, fixedAmount, fixedMultiplier);

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet",
        {
          username,
          amount: fixedAmount,
          multiplier: fixedMultiplier,
        },
        {
          params: {
            action: "cashout",
            server: "Crash",
          },
        }
      );

      console.log("✅ CASHOUT RESPONSE:", res.data);

    } catch (err) {
      console.log("❌ CASHOUT ERROR:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ DISCONNECTED:", socket.id);
  });
});

// 🛡️ ERROR HANDLING
process.on("uncaughtException", (err) => {
  console.log("❌ ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("❌ PROMISE:", err);
});

// ▶️ START GAME
startGame();

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING:", PORT);
});
