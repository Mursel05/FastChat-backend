const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./server/config/db");
const messageRoutes = require("./server/routes/message");
const chatRoutes = require("./server/routes/chat");
const userRoutes = require("./server/routes/user");
const fileRoutes = require("./server/routes/file");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./server/config/swagger");
const path = require("path");
const cors = require("cors");
const http = require("http");
const setupWebSocket = require("./server/config/wss");

dotenv.config();

const app = express();
const port = process.env.PORT;
const server = http.createServer(app);
setupWebSocket(server);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

connectDB();

app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/files", fileRoutes);

app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err, req, res, next) => {
  console.log("Error: ", err);
  res.status(500).json({ success: false, message: "Server error" });
});

server.listen(port, () => {
  console.log(`Server running on ${port}`);
});
