// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

// 🔥 Railway PORT fix
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Socket running ✅");
});

// 🔥 Socket setup
const io = new Server(server, {
  cors: { origin: "*" },
  path: "/socket.io",
  transports: ["polling"],
});

let round = 1;

// 🔥 GLOBAL GAME LOOP (sirf 1 baar chalega)
function startGame() {
  const crashPoint = parseFloat((Math.random() * 5 + 1).toFixed(2));
  let multiplier = 1.0;

  console.log("🚀 ROUND:", round, "CRASH:", crashPoint);

  io.emit("prepareplane");

  setTimeout(() => {
    io.emit("flyplane");

    const interval = setInterval(() => {
      multiplier += 0.01;

      io.emit("crash-update", {
        crashpoint: parseFloat(multiplier.toFixed(2)),
      });

      if (multiplier >= crashPoint) {
        clearInterval(interval);

        console.log("💥 CRASHED AT:", crashPoint);

        io.emit("crash-update", { crashpoint: crashPoint });
        io.emit("reset");

        round++;
        setTimeout(startGame, 3000);
      }
    }, 100);
  }, 2000);
}

// 🔥 SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("✅ USER CONNECTED:", socket.id);

  socket.onAny((event, data) => {
    console.log("📡 EVENT:", event, data);
  });

  // 👉 BET EVENT (IMPORTANT)
  socket.on("newBet", async (username, amount) => {
    console.log("💰 BET:", username, amount);

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username: username,
          period: Date.now(),
          ans: "manual",
          amount: amount
        })
      );

      console.log("✅ SAVED TO PHP:", res.data);

    } catch (err) {
      console.log("❌ API ERROR:", err.message);
    }
  });

  socket.on("cashout", (data) => {
    console.log("💸 CASHOUT:", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ DISCONNECTED:", socket.id);
  });
});

// 🔥 Error protection (important for Railway)
process.on("uncaughtException", (err) => {
  console.log("❌ UNCAUGHT:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("❌ PROMISE ERROR:", err);
});

// 👉 Start game once
startGame();

// 👉 Start server
server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING ON PORT:", PORT);
});
