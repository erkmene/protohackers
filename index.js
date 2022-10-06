const net = require("net");
const dgram = require("dgram");

const serverDefs = [
  { port: 9000, name: "Echo Server", handler: require("./servers/echoServer") },
  {
    port: 9001,
    name: "Prime Server",
    type: "tcp",
    handler: require("./servers/primeServer"),
  },
  {
    port: 9002,
    name: "Asset Server",
    type: "tcp",
    handler: require("./servers/assetServer"),
  },
  {
    port: 9003,
    name: "Chat Server",
    type: "tcp",
    handler: require("./servers/chatServer"),
  },
  {
    port: 9004,
    name: "Database Server",
    type: "udp",
    handler: require("./servers/dbServer"),
  },
];

const printServerInfo = (serverDef, server) => {
  console.log("----------------------------------------");
  console.log(`${serverDef.name} listening to %s`, server.address());
  console.log("----------------------------------------");
};

serverDefs.forEach((serverDef) => {
  let server;
  if (serverDef.type === "udp") {
    server = dgram.createSocket("udp4");
    server.on("message", (msg, info) => serverDef.handler(server, msg, info));
    server.on("listening", () => printServerInfo(serverDef, server));
    server.bind(serverDef.port);
  } else {
    server = net.createServer();
    server.on("connection", serverDef.handler);
    server.listen(serverDef.port, () => printServerInfo(serverDef, server));
  }
  serverDef.server = server;
});
