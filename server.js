const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: "*" },
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
  io.emit("working");
  io.emit("prepareplane");

  setTimeout(() => {
    io.emit("flyplane");
    io.emit("crash-update", { crashpoint: 1.0 });

    let interval = setInterval(() => {
      multiplier = Number((multiplier + 0.01).toFixed(2));

      io.emit("crash-update", { crashpoint: multiplier });

      if (multiplier >= crashPoint) {

        clearInterval(interval);

        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

        // 💾 SAVE CRASH RESULT
        (async () => {
          try {
            await axios.post(
              "https://jalwagame5.shop/jet/trova/src/api/bet",
              new URLSearchParams({
                crashpoint: finalCrash,
                time: new Date().toISOString(),
              }),
              {
                params: { action: "savecrash" },
              }
            );

            console.log("💾 SAVED:", finalCrash);
          } catch (err) {
            console.log("❌ SAVE ERROR:", err.message);
          }
        })();

        // 📡 EMIT CRASH
        io.emit("crash-update", { crashpoint: finalCrash });
        io.emit("reset");

        // 📊 SEND HISTORY PER USER
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
                }
              );

              let history = Array.isArray(res.data) ? res.data : [];

              socket.emit("updatehistory", history);

            } catch (err) {
              console.log("❌ HISTORY ERROR:", err.message);
            }
          }
        }, 500);

        setTimeout(startGame, 5000);
      }
    }, 100);
  }, 1000);
}

// 🔌 SOCKET
io.on("connection", (socket) => {

  console.log("✅ CONNECTED:", socket.id);

  // 👤 USER SET
  socket.on("userid", (userId) => {
    socket.userId = userId;
    console.log("👤 USER:", userId);
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
        })
      );

      console.log("✅ BET:", res.data);

    } catch (err) {
      console.log("❌ BET ERROR:", err.message);
    }
  });

  // 💸 CASHOUT
  socket.on("addWin", async (username, amount, multiplier) => {

    if (!amount || amount <= 0) return;

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet",
        {
          username,
          amount,
          multiplier,
        },
        {
          params: {
            action: "cashout",
            server: "Crash",
          },
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

// ▶️ START
startGame();

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING:", PORT);
});
