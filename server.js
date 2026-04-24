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
function startGame() {

  currentPeriod = getNextPeriod();
  let multiplier = 1.0;
  const crashPoint = Number((Math.random() * 5 + 1).toFixed(2));

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);

  // 🟡 BETTING PHASE
  io.emit("working");
  io.emit("prepareplane");

  setTimeout(() => {

    // ✈️ GAME START
    io.emit("flyplane");

    // ✅ initial value (NaN fix)
    io.emit("crash-update", { crashpoint: 1.0 });

    let gameInterval = null;

    gameInterval = setInterval(() => {

      // ✅ safe multiplier
      multiplier = Number((multiplier + 0.01).toFixed(2));
      if (!multiplier || isNaN(multiplier)) multiplier = 1;

      io.emit("crash-update", {
        crashpoint: multiplier,
      });

      // 💥 CRASH CONDITION
      if (multiplier >= crashPoint) {

        clearInterval(gameInterval);
        gameInterval = null;

        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

        // 1️⃣ final multiplier
        io.emit("crash-update", {
          crashpoint: finalCrash,
        });

        // 2️⃣ delay for frontend sync
        setTimeout(async () => {

          // 3️⃣ reset events
          io.emit("reset");
          io.emit("removecrash");

          // 4️⃣ history (REAL API)
          try {
            const res = await axios.get(
              "https://jalwagame5.shop/jet/trova/src/api/bet?action=gethistory"
            );

            if (Array.isArray(res.data)) {
              io.emit("updatehistory", res.data);
            } else {
              // fallback
              io.emit("updatehistory", [
                {
                  time: Date.now(),
                  bet: 10,
                  mult: finalCrash,
                  cashout: 0
                }
              ]);
            }

            console.log("📊 HISTORY UPDATED");

          } catch (err) {
            console.log("❌ HISTORY ERROR:", err.message);

            // fallback safe
          const fixedHistory = res.data.map(item => {

  const time = item.time 
    || (item.created_at ? new Date(item.created_at).getTime() : Date.now());

  const bet = Number(item.bet || item.amount || 10);

  const mult = Number(item.mult || item.crash || 1.0);
  
  const cashout = Number(item.cashout || (bet * mult) || 0);

  return {
    time,
    bet,
    mult: mult > 0 ? mult : 1.0, // ❗ never 0
    cashout
  };
});

io.emit("updatehistory", fixedHistory);;
}
          }

        }, 200);

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
socket.on("userid", (userId, payload) => {

  // ignore spam
  if (socket.userId) return;

  // ignore agar payload bada hai (history aa rahi hai)
  if (payload && typeof payload === "object") {
    console.log("⚠️ Ignoring payload spam");
  }

  socket.userId = userId;
});
  // 💰 BET
  socket.on("newBet", async (username, amount) => {

    if (!amount || amount <= 0) return;

    console.log("💰 BET:", username, amount);

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
