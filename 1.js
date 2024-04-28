const message = {
  chats: [
    {
      sender: "user1",
      message: "Hello",
      seen: false,
    },
    {
      sender: "user2",
      message: "Hi",
      seen: false,
    },
  ],
};

const data = {
  uid: "user1",
  persons: ["user1", "user2"],
  chat: {
    sender: "user1",
    message: "Hello",
    seen: false,
  },
};

message.chats = [...message.chats, data.chat];
console.log(message.chats);

message.chats = message.chats.map((chat) =>
  chat.sender == data.uid ? chat : { ...chat, seen: false }
);
console.log(message.chats);
