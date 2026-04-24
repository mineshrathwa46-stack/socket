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
  transports: ["websocket"],
});

// 🔢 PERIOD
let period = 100000000000000;
let currentPeriod;

function getNextPeriod() {
  return ++period;
}

// 🎮 GAME LOOP
function startGame() {
  currentPeriod = getNextPeriod();
  let multiplier = 1.0;
  const crashPoint = Number((Math.random() * 5 + 1).toFixed(2));

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);
  io.emit("removecrash");
  io.emit("working"); // waiting
  io.emit("prepareplane");

  setTimeout(() => {
    setTimeout(() => {
      io.emit("flyplane");
      io.emit("crash-update", { crashpoint: 1.0 });
    }, 1000);

    let interval = setInterval(() => {
      multiplier = Number((multiplier + 0.01).toFixed(2));
      if (!multiplier || isNaN(multiplier)) multiplier = 1;

      io.emit("crash-update", { crashpoint: multiplier });

      if (multiplier >= crashPoint) {
        clearInterval(interval);

        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

        // 1️⃣ crash show
        io.emit("crash-update", { crashpoint: finalCrash });
        io.emit("reset");
        setTimeout(async () => {
          for (const [id, socket] of io.sockets.sockets) {
            if (!socket.userId) continue;

            try {
              const res = await axios.get(
                "https://jalwagame5.shop/jet/trova/src/api/bet",
                {
                  params: {
                    action: "gethistory",
                    username: socket.userId,
                  },
                  timeout: 5000,
                },
              );

              let history = [];

              if (Array.isArray(res.data)) {
                history = res.data.map((item) => ({
                  time: Number(item.time),
                  bet: Number(item.bet),
                  mult: Number(item.mult),
                  cashout: Number(item.cashout),
                }));
              }

              // ✅ send per user
              socket.emit("updatehistory", history);

              console.log("📊 HISTORY SENT:", socket.userId);
            } catch (err) {
              console.log("❌ HISTORY ERROR:", err.message);
            }
          }
        }, 600);

        setTimeout(startGame, 5000);
      }
    }, 100);
  }, 1000);
}

// 🔌 SOCKET
io.on("connection", (socket) => {
  console.log("✅ CONNECTED:", socket.id);

  socket.onAny((event, data) => {
    console.log("📡", event, data);
  });

  // 🔒 USER FIX
  socket.on("userid", (userId) => {
    if (!userId) return;

    socket.userId = userId; // ✅ store user

    console.log("👤 USER CONNECTED:", userId);
  });
  // 💰 BET
  socket.on("newBet", async (username, amount) => {
    if (!amount || amount <= 0) return;

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username,
          period: currentPeriod,
          ans: "manual",
          amount,
        }),
      );

      console.log("✅ BET:", res.data);
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
        },
      );

      console.log("💸 CASHOUT:", res.data);
    } catch (err) {
      console.log("❌ CASHOUT ERROR:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ DISCONNECTED:", socket.id);
  });
});

// 🛡️ ERRORS
process.on("uncaughtException", (err) => console.log("❌ ERROR:", err));
process.on("unhandledRejection", (err) => console.log("❌ PROMISE:", err));

// ▶️ START
startGame();

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING:", PORT);
});
