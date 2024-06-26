import { WebSocketServer } from "ws";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { setFlagsFromString } from "v8";

setFlagsFromString("--max-old-space-size=8192");

const PORT = 8080;
const URL = process.env.MONGO_DATABASE_URL;

mongoose
  .connect(URL)
  .then(() => console.log("MongoDB connected"))
  .catch((e) => console.log("mongoDb", e));

const Message = mongoose.model("Message", {
  clearOne: String,
  persons: [String],
  chats: [
    {
      time: String,
      message: String || Array,
      sender: String,
      seen: Boolean,
      chatType: String,
      chatId: Number,
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

const wss = new WebSocketServer(
  { port: PORT, maxPayload: 1024 * 1024 * 200 },
  (err) => {
    if (err) console.log("socket", err);
    else console.log("WebSocketServer is running on port", PORT);
  }
);

const clients = [];

const broadcast = (data, uid) => {
  const client = clients.find((client) => client.uid == uid);
  if (client) {
    client.ws.send(data);
  }
};

async function sendMessage(userUid, success) {
  const messages = await Message.find({
    persons: { $in: [userUid] },
  });
  const uids = messages
    ?.filter((item) => item.clearOne != userUid)
    .map((message) =>
      message.persons[0] == userUid ? message.persons[1] : message.persons[0]
    );
  const otherUsers = uids.map(
    async (uid) =>
      await User.findOne({
        uid,
      })
  );
  broadcast(
    JSON.stringify({
      success,
      messages,
      otherUsers: await Promise.all(otherUsers),
    }),
    userUid
  );
}

async function setLastSeen(uid, online) {
  const d = new Date();
  const user = await User.findOne({ uid });
  const lastSeen = online ? online : d.toString().slice(4, 21);
  if (user) {
    user.lastSeen = lastSeen;
    await user.save();
  }
}

wss.on("connection", function connection(ws) {
  ws.on("message", async function message(req) {
    try {
      const data = JSON.parse(req);
      if (data.uid && !clients.some((client) => client.uid == data.uid)) {
        clients.push({ ws, uid: data.uid });
        setLastSeen(data.uid, "Online");
        console.log(data.uid, "connected");
      }
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
                sendMessage(person, "Chat added");
              });
            } else {
              ws.send(JSON.stringify({ error: "Message not found" }));
            }
          }
          break;
        case "changeSeen":
          {
            const message = await Message.findOne({
              persons: { $all: data.persons },
            });
            if (message) {
              message.chats = message.chats.map((chat) =>
                chat.sender == data.otherUserUid
                  ? { ...chat, seen: true }
                  : chat
              );
              await message.save();
              data.persons.forEach((person) => {
                sendMessage(person, "Seen changed");
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
            if (!user) {
              ws.send(JSON.stringify({ error: "User not found" }));
            } else {
              const messages = await Message.find({
                persons: { $in: [data.uid] },
              });
              const uids = messages
                .filter((item) => item.clearOne != user?.uid)
                ?.map((message) =>
                  message.persons[0] == user?.uid
                    ? message.persons[1]
                    : message.persons[0]
                );
              const otherUsers = uids.map(
                async (uid) =>
                  await User.findOne({
                    uid,
                  })
              );
              ws.send(
                JSON.stringify({
                  success: "Data founded",
                  messages,
                  user,
                  otherUsers: await Promise.all(otherUsers),
                })
              );
            }
          }
          break;
        case "addMessage":
          {
            const user = await User.findOne({
              uid: data.uid,
            });
            if (!user) {
              ws.send(JSON.stringify({ error: "User not found" }));
            } else {
              const message = new Message({
                persons: data.persons,
                clearOne: "",
                chats: [],
              });
              await message.save();
              data.persons.forEach((person) => {
                sendMessage(person, "Message added");
              });
            }
          }
          break;
        case "deleteMessage":
          {
            const user = await User.findOne({
              uid: data.uid,
            });
            if (!user) {
              ws.send(JSON.stringify({ error: "User not found" }));
            } else {
              const message = await Message.findOne({
                _id: data.messageId,
              });
              if (message.clearOne == "") {
                message.clearOne = data.uid;
                await message.save();
              } else {
                await Message.deleteOne({ _id: data.messageId });
              }
              const messages = await Message.find({
                persons: { $in: [data.uid] },
              });
              const uids = messages
                .filter((item) => item.clearOne != user?.uid)
                ?.map((message) =>
                  message.persons[0] == user?.uid
                    ? message.persons[1]
                    : message.persons[0]
                );
              const otherUsers = uids.map(
                async (uid) =>
                  await User.findOne({
                    uid,
                  })
              );
              ws.send(
                JSON.stringify({
                  success: "Message deleted",
                  messages,
                  user,
                  otherUsers: await Promise.all(otherUsers),
                })
              );
            }
          }
          break;
        case "addUser":
          {
            const userSearch = await User.findOne({
              uid: data.uid,
            });
            if (!userSearch) {
              const d = new Date();
              const user = new User({
                email: data.email,
                lastSeen: d.toString().slice(4, 21),
                name: data.name,
                photo: data.photo,
                surname: data.surname,
                uid: data.uid,
              });
              await user.save();
            }
          }
          break;
        case "getUsersByEmail":
          {
            const users = await User.find({
              email: { $regex: data.email, $options: "i" },
            });
            ws.send(
              JSON.stringify({
                success: "User founded",
                users,
              })
            );
          }
          break;
        default: {
          const messages = await Message.find({
            persons: { $in: [data.uid] },
          });
          const uids = messages
            .filter((item) => item.clearOne != data.uid)
            ?.map((message) =>
              message.persons[0] == data.uid
                ? message.persons[1]
                : message.persons[0]
            );
          const otherUsers = uids.map(
            async (uid) =>
              await User.findOne({
                uid,
              })
          );
          ws.send(
            JSON.stringify({ error: "Invalid type", messages, otherUsers })
          );
          console.log("Invalid type", error);
        }
      }
    } catch (error) {
      const data = JSON.parse(req);
      const messages = await Message.find({
        persons: { $in: [data.uid] },
      });
      const uids = messages
        .filter((item) => item.clearOne != data.uid)
        ?.map((message) =>
          message.persons[0] == data.uid
            ? message.persons[1]
            : message.persons[0]
        );
      const otherUsers = uids.map(
        async (uid) =>
          await User.findOne({
            uid,
          })
      );
      ws.send(JSON.stringify({ error: "Invalid JSON", messages, otherUsers }));
      console.log("Invalid JSON", error);
    }
  });
  ws.on("close", () => {
    const index = clients.findIndex((client) => client.ws === ws);
    if (index !== -1) {
      console.log(clients[index].uid, "disconnected");
      setLastSeen(clients[index].uid);
      clients.splice(index, 1)[0].uid;
    }
  });
});
