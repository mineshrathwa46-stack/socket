const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const mysql = require("mysql2/promise");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

// ✅ DB
const db = mysql.createPool({
  host: "184.174.36.72",
  user: "jalwagam_minurtw",
  password: "Minurtw@12345",
  database: "jalwagam_minurtw"
});

let currentPeriod;

function getNextPeriod() {
  return Date.now();
}

// 🔥 DB check function
async function getCrashFromDB() {
  const [rows] = await db.query(
    "SELECT crashpoint FROM crash_admin_control WHERE id = 1"
  );

  if (rows.length && rows[0].crashpoint !== null) {
    return Number(rows[0].crashpoint);
  }

  return null;
}

// 🔥 reset DB
async function resetCrashDB() {
  await db.query(
    "UPDATE crash_admin_control SET crashpoint = NULL WHERE id = 1"
  );
}

// 🎮 GAME LOOP
async function startGame() {
  currentPeriod = getNextPeriod();

  let multiplier = 1.0;

  // 👉 check DB first
  const dbCrash = await getCrashFromDB();

  const crashPoint =
    dbCrash !== null
      ? Number(parseFloat(dbCrash).toFixed(2))
      : Number((Math.random() * 5 + 1).toFixed(2));

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);

  io.emit("removecrash");
  io.emit("working");
  io.emit("prepareplane");

  setTimeout(() => {
    io.emit("flyplane");
    io.emit("crash-update", { crashpoint: 1.0 });

    let interval = setInterval(async () => {
      multiplier = Number((multiplier + 0.01).toFixed(2));

      io.emit("crash-update", { crashpoint: multiplier });

      if (multiplier >= crashPoint) {
        clearInterval(interval);

        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

        // 💾 SAVE CRASH
        try {
          await axios.post(
            "https://jalwagame5.shop/jet/trova/src/api/bet",
            new URLSearchParams({
              crashpoint: finalCrash,
              id: currentPeriod,
              time: new Date().toISOString(),
            }),
            { params: { action: "savecrash" } }
          );

          console.log("💾 SAVED:", finalCrash);
        } catch (err) {
          console.log("❌ SAVE ERROR:", err.message);
        }

        // 🔥 RESET DB (important)
        await resetCrashDB();

        io.emit("crash-update", { crashpoint: finalCrash });
        io.emit("reset");

        setTimeout(startGame, 5000);
      }
    }, 100);
  }, 1000);
}

// 🔌 SOCKET
io.on("connection", (socket) => {
  console.log("✅ CONNECTED:", socket.id);

  // 👤 USER
  socket.on("userid", (userId) => {
    socket.userId = userId;
    console.log("👤 USER:", userId);
  });

  // 💰 BET
  socket.on("newBet", async (username, amount) => {
    const fixedAmount = Number(parseFloat(amount).toFixed(2));
    if (!fixedAmount || fixedAmount <= 0) return;

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username,
          period: currentPeriod,
          ans: "manual",
          amount: fixedAmount,
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

    const fixedMultiplier = Number(multiplier.toFixed(2));
    const fixedAmount = Number(parseFloat(amount).toFixed(2));

    try {
      const res = await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet",
        {
          username,
          amount: fixedAmount,
          multiplier: fixedMultiplier,
          period: currentPeriod,
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

  // 🔥 ADMIN CONTROL (DB based)
  socket.on("adminCrash", async (data) => {
    if (!data || data.key !== "SECRET123") return;

    const value = Number(parseFloat(data.value).toFixed(2));

    if (!value || value < 1) return;

    try {
      await db.query(
        "UPDATE crash_admin_control SET crashpoint = ? WHERE id = 1",
        [value]
      );

      console.log("🛠 ADMIN SET:", value);

      socket.emit("adminAck", { status: "ok", value });

    } catch (err) {
      console.log("❌ ADMIN ERROR:", err.message);
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
