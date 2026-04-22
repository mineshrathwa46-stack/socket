const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ✅ BASIC ROUTE
app.get("/", (req, res) => {
  res.send("Socket running ✅");
});

// ✅ SOCKET SETUP
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  path: "/socket.io",
  transports: ["polling"], // hosting safe
});

let round = 1;

io.on("connection", (socket) => {
  console.log("✅ USER CONNECTED:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ DISCONNECTED:", socket.id);
  });

  function startGame() {
    const crashPoint = (Math.random() * 5 + 1).toFixed(2);
    let multiplier = 1.0;

    console.log("🚀 ROUND:", round, "CRASH:", crashPoint);

    // 🔥 PREPARE PHASE
    socket.emit("prepareplane");

    setTimeout(() => {
      // 🔥 START FLYING
      socket.emit("flyplane");

      const interval = setInterval(() => {
        multiplier += 0.1;

        // 🔥 LIVE MULTIPLIER UPDATE
        socket.emit("crash-update", {
          crashpoint: multiplier.toFixed(2),
        });

        // 🔥 STATUS (VERY IMPORTANT)
        socket.emit("working");

        // 💥 CRASH CONDITION
        if (multiplier >= crashPoint) {
          clearInterval(interval);

          console.log("💥 CRASHED AT:", crashPoint);

          socket.emit("crash-update", {
            crashpoint: crashPoint,
          });

          socket.emit("reset");

          round++;

          // ⏳ NEXT ROUND
          setTimeout(startGame, 3000);
        }
      }, 500);
    }, 2000);
  }

  startGame();
});

// 🚀 START SERVER
server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING ON PORT:", PORT);
});
