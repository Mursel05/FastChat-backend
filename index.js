const PORT = 8080;

import { WebSocketServer } from "ws";
import mongoose from "mongoose";

mongoose.connect(
  "mongodb+srv://mursalhaqverdiyev05:1FK7YgBrzPMGySoh@cluster0.opg488b.mongodb.net/fastchat"
);

const Message = mongoose.model("Message", {
  persons: [String],
  chats: [
    {
      time: String,
      message: String,
      sender: String,
    },
  ],
});

const wss = new WebSocketServer({ port: PORT }, (err) => {
  if (err) console.log(err);
  else console.log("Server is running on port", PORT);
});

wss.on("connection", function connection(ws) {
  ws.on("message", async function message(req) {
    const data = JSON.parse(req);

    switch (data.type) {
      case "addMessage":
        const message = await Message.findOne({
          persons: data.persons,
        });
        if (message) {
          message.chats = [...message.chats, data.chat];
          await message.save();
          const messages = await Message.find({});
          ws.send(JSON.stringify({ success: "Message added", messages }));
        } else {
          ws.send(JSON.stringify({ error: "Message not found" }));
        }
        break;
        
      default:
        ws.send(JSON.stringify({ error: "Invalid type" }));
    }

  });
});
