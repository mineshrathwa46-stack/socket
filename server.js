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

let currentPeriod;

const API = "https://jalwagame5.shop/jet/trova/src/api/api_crash.php";

function getNextPeriod() {
  return Date.now();
}

async function getCrashFromAPI() {
  try {
    const res = await axios.get(API, {
      params: { action: "get" }
    });
    return res.data.crashpoint;
  } catch (err) {
    console.log("❌ GET API ERROR:", err.message);
    return null;
  }
}

async function resetCrashAPI() {
  try {
    await axios.get(API, {
      params: { action: "reset" }
    });
  } catch (err) {
    console.log("❌ RESET ERROR:", err.message);
  }
}

async function setCrashAPI(value) {
  try {
    await axios.post(
      API + "?action=set",
      new URLSearchParams({
        crashpoint: value,
        key: "SECRET123"
      })
    );
  } catch (err) {
    console.log("❌ SET ERROR:", err.message);
  }
}

// 🎮 GAME LOOP
async function startGame() {
  currentPeriod = getNextPeriod();

  const dbCrash = await getCrashFromAPI();

  const crashPoint =
    dbCrash !== null
      ? Number(parseFloat(dbCrash).toFixed(2))
      : Number((Math.random() * 5 + 1).toFixed(2));

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);

  // ✅ STEP 1: prepare
  io.emit("prepareplane");

  // ✅ STEP 2: delay for UI ready
  setTimeout(() => {

    // ✅ STEP 3: working (betting phase)
    io.emit("working");

    // ✅ STEP 4: delay BEFORE flyplane (IMPORTANT)
    setTimeout(() => {

      io.emit("flyplane");

      let startTime = Date.now();

      function runCrashLoop() {
        let elapsed = (Date.now() - startTime) / 1000;

        let multiplier = Number((Math.exp(0.15 * elapsed)).toFixed(2));

        io.emit("crash-update", { crashpoint: multiplier });

        if (multiplier >= crashPoint) {
          finishGame();
          return;
        }

        setTimeout(runCrashLoop, 100);
      }

      async function finishGame() {
        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

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
        } catch (err) {
          console.log("❌ SAVE ERROR:", err.message);
        }

        await resetCrashAPI();

        // ✅ FINAL EVENTS ORDER (VERY IMPORTANT)
        io.emit("crash-update", { crashpoint: finalCrash });

        setTimeout(() => {
          io.emit("reset");

          setTimeout(() => {
            io.emit("removecrash");

            // ✅ next round
            setTimeout(startGame, 4000);

          }, 1000);

        }, 500);
      }

      runCrashLoop();

    }, 2000); // ⬅️ IMPORTANT delay before fly

  }, 2000); // ⬅️ UI prepare delay
}
// 🔌 SOCKET
io.on("connection", (socket) => {
  console.log("✅ CONNECTED:", socket.id);

  socket.on("userid", (userId) => {
    socket.userId = userId;
  });

  socket.on("newBet", async (username, amount) => {
    const fixedAmount = Number(parseFloat(amount).toFixed(2));
    if (!fixedAmount || fixedAmount <= 0) return;

    try {
      await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username,
          period: currentPeriod,
          ans: "manual",
          amount: fixedAmount,
        })
      );
    } catch (err) {
      console.log("❌ BET ERROR:", err.message);
    }
  });

  socket.on("addWin", async (username, amount, multiplier) => {
    if (!amount || amount <= 0) return;

    const fixedMultiplier = Number(multiplier.toFixed(2));
    const fixedAmount = Number(parseFloat(amount).toFixed(2));

    try {
      await axios.post(
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
    } catch (err) {
      console.log("❌ CASHOUT ERROR:", err.message);
    }
  });

  socket.on("adminCrash", async (data) => {
    if (!data || data.key !== "SECRET123") return;

    const value = Number(parseFloat(data.value).toFixed(2));
    if (!value || value < 1) return;

    await setCrashAPI(value);

    console.log("🛠 ADMIN SET:", value);

    socket.emit("adminAck", { status: "ok", value });
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
