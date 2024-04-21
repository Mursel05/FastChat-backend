import { WebSocketServer } from "ws";
import mongoose, { connect } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const PORT = 8080;
const URL = process.env.MONGO_DATABASE_URL;

mongoose
  .connect(URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((e) => console.log(e));

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

const User = mongoose.model("User", {
  email: String,
  lastSeen: String,
  name: String,
  photo: String,
  surname: String,
  uid: String,
});

const wss = new WebSocketServer({ port: PORT }, (err) => {
  if (err) console.log(err);
  else console.log("WebSocketServer is running on port", PORT);
});

const clients = [];

const broadcast = (data, uid) => {
  const client = clients.find((client) => client.uid == uid);
  if (client) {
    client.ws.send(data);
  }
};
async function sendMessage(uid) {
  const messages = await Message.find({
    persons: { $in: [uid] },
  });
  broadcast(JSON.stringify({ success: "Chat added", messages }), uid);
}

wss.on("connection", function connection(ws) {
  ws.on("message", async function message(req) {
    try {
      const data = JSON.parse(req);
      !clients.some((client) => client.uid == data.uid) &&
        clients.push({ ws, uid: data.uid });
      switch (data.type) {
        case "addChat":
          {
            const message = await Message.findOne({
              persons: { $all: data.persons },
            });
            if (message) {
              message.chats = [...message.chats, data.chat];
              await message.save();
              data.persons.forEach((person) => {
                sendMessage(person);
              });
            } else {
              ws.send(JSON.stringify({ error: "Message not found" }));
            }
          }
          break;
        case "getData":
          {
            const user = await User.findOne({
              uid: data.uid,
            });
            const messages = await Message.find({
              persons: { $in: [data.uid] },
            });
            if (!user) {
              ws.send(JSON.stringify({ error: "User not found" }));
            }
            ws.send(
              JSON.stringify({ success: "Data founded", user, messages })
            );
          }
          break;
        case "addMessage":
          {
            const message = new Message({
              persons: data.persons,
              chats: [],
            });
            await message.save();
            const user = await User.findOne({
              uid: data.uid,
            });
            const messages = await Message.find({
              persons: { $in: [data.uid] },
            });
            if (!user) {
              ws.send(JSON.stringify({ error: "User not found" }));
            }
            ws.send(JSON.stringify({ success: "Message added", messages }));
          }
          break;
        case "addUser":
          {
            const user = new User({
              email: data.email,
              lastSeen: data.lastSeen,
              name: data.name,
              photo: data.photo,
              surname: data.surname,
              uid: data.uid,
            });
            await user.save();
            const messages = await Message.find({
              persons: { $in: [data.uid] },
            });
            ws.send(JSON.stringify({ success: "User added", user, messages }));
          }
          break;
        case "getUserByUid":
          {
            const otherUser = await User.findOne({
              uid: data.otherUid,
            });
            const user = await User.findOne({
              uid: data.uid,
            });
            const messages = await Message.find({
              persons: { $in: [data.uid] },
            });
            if (!user) {
              ws.send(JSON.stringify({ error: "User not found" }));
            }
            ws.send(
              JSON.stringify({
                success: "User founded",
                otherUser,
                messages,
              })
            );
          }
          break;
        default:
          ws.send(JSON.stringify({ error: "Invalid type" }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ error: "Invalid JSON" }));
      console.log(error);
    }
  });
  ws.on("close", () => {
    const index = clients.findIndex((client) => client.ws === ws);
    if (index !== -1) {
      clients.splice(index, 1)[0].uid;
    }
  });
});
