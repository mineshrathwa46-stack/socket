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
  transports: ["polling"]
});

// 🔢 PERIOD SYSTEM
let period = 100000000000000;
let currentPeriod;

function getNextPeriod() {
  period++;
  return period;
}

// 🎮 GAME LOOP
function startGame() {

  currentPeriod = getNextPeriod();
  let multiplier = 1.0;
  const crashPoint = parseFloat((Math.random() * 5 + 1).toFixed(2));

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);

  // 🟡 PREPARE
  io.emit("prepareplane");

  setTimeout(() => {

    // ✈️ START
    io.emit("flyplane");

    const interval = setInterval(() => {

      multiplier += 0.01;

      io.emit("crash-update", {
        crashpoint: parseFloat(multiplier.toFixed(2))
      });

      if (multiplier >= crashPoint) {
        clearInterval(interval);

        console.log("💥 CRASH:", crashPoint);

        io.emit("crash-update", {
          crashpoint: crashPoint
        });

        // io.emit("reset");

        // 🧹 CLEANUP EVENTS
        io.emit("removecrash");

        // (optional) history update
        // io.emit("updatehistory", {
        //   crash: crashPoint,
        //   period: currentPeriod
        // });

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
socket.on("working", (s) => {
  console.log("WORKING DATA:", s);
});
socket.on("reset", (s) => {
  console.log("RESET DATA:", s);
});
socket.on("updatehistory", (s) => {
  console.log("UPDATE HISTORY DATA:", s);
});
  // 💰 BET
  socket.on("newBet", async (username, amount) => {

    console.log("💰 BET:", username, amount);

    try {

      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username,
          period: currentPeriod,
          ans: "manual",
          amount
        })
      );

      console.log("✅ BET RESPONSE:", res.data);

    } catch (err) {
      console.log("❌ BET ERROR:", err.message);
    }
  });

  // 💸 CASHOUT
  socket.on("addWin", async (username, amount, multiplier) => {

    const winAmount = parseFloat(amount) * parseFloat(multiplier);

    console.log("💸 CASHOUT:", username, winAmount);

    try {

      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet",
        {
          username,
          amount,
          multiplier
        },
        {
          params: {
            action: "cashout",
            server: "Crash"
          }
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

// 🛡️ ERROR SAFE
process.on("uncaughtException", (err) => {
  console.log("❌ ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("❌ PROMISE:", err);
});

// ▶️ START
startGame();

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING:", PORT);
});
