const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Socket running ✅");
});

const io = new Server(server, {
  cors: { origin: "*" },
  path: "/socket.io",
  transports: ["polling"],
});

let round = 1;

io.on("connection", (socket) => {
  console.log("✅ USER CONNECTED:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ DISCONNECTED:", socket.id);
  });
socket.on("newBet", (s, t) => {
  console.log("BET RECEIVED:", s, t);
});

  socket.on("cashout", (data) => {
    console.log("CASHOUT:", data);
  });
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

// 👇 OUTSIDE connection
startGame();
  startGame();
});

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING ON PORT:", PORT);
});
