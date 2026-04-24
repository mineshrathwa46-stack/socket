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

  io.emit("working");
  io.emit("prepareplane");

  setTimeout(() => {

    io.emit("flyplane");
    io.emit("crash-update", { crashpoint: 1.0 });

    let interval = setInterval(() => {

      multiplier = Number((multiplier + 0.01).toFixed(2));
      if (!multiplier || isNaN(multiplier)) multiplier = 1;

      io.emit("crash-update", { crashpoint: multiplier });

      if (multiplier >= crashPoint) {

        clearInterval(interval);

        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

        io.emit("crash-update", { crashpoint: finalCrash });

        setTimeout(async () => {

          io.emit("reset");
          io.emit("removecrash");

          // ✅ HISTORY FIX
          try {
            const res = await axios.get(
              "https://jalwagame5.shop/jet/trova/src/api/bet?action=gethistory",
              { timeout: 5000 }
            );

            let history = [];

            if (Array.isArray(res.data)) {

              history = res.data.map(item => {

                const time = item.time 
                  || (item.created_at ? new Date(item.created_at).getTime() : Date.now());

                const bet = Number(item.bet || item.amount || 10);

                const multRaw = Number(item.mult || item.crash || 1.0);
                const mult = multRaw > 0 ? multRaw : 1.0;

                const cashout = Number(item.cashout || (bet * mult) || 0);

                return { time, bet, mult, cashout };
              });

            } else {
              // fallback
              history = [{
                time: Date.now(),
                bet: 10,
                mult: finalCrash,
                cashout: 0
              }];
            }

            io.emit("updatehistory", history);
            console.log("📊 HISTORY OK");

          } catch (err) {

            console.log("❌ HISTORY ERROR:", err.message);

            // safe fallback
            io.emit("updatehistory", [{
              time: Date.now(),
              bet: 10,
              mult: finalCrash,
              cashout: 0
            }]);
          }

        }, 200);

        setTimeout(startGame, 3000);
      }

    }, 100);

  }, 2000);
}

// 🔌 SOCKET
io.on("connection", (socket) => {

  console.log("✅ CONNECTED:", socket.id);

  socket.onAny((event, data) => {
    console.log("📡", event, data);
  });

  // 🔒 USER FIX
  socket.on("userid", (userId, payload) => {
    if (socket.userId) return;
    if (!userId || typeof userId !== "string") return;
    socket.userId = userId.trim();
    console.log("👤 USER:", socket.userId);
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
          amount
        })
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
          multiplier: fixedMultiplier
        },
        {
          params: {
            action: "cashout",
            server: "Crash"
          }
        }
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
process.on("uncaughtException", err => console.log("❌ ERROR:", err));
process.on("unhandledRejection", err => console.log("❌ PROMISE:", err));

// ▶️ START
startGame();

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING:", PORT);
});
