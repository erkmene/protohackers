const net = require("net");

const serverDefs = [
  { port: 9000, name: "Echo Server", handler: require("./servers/echoServer") },
  {
    port: 9001,
    name: "Prime Server",
    handler: require("./servers/primeServer"),
  },
  {
    port: 9002,
    name: "Asset Server",
    handler: require("./servers/assetServer"),
  },
  {
    port: 9003,
    name: "Chat Server",
    handler: require("./servers/chatServer"),
  },
];

serverDefs.forEach((serverDef) => {
  const server = net.createServer();
  server.on("connection", serverDef.handler);
  server.listen(serverDef.port, function () {
    console.log("----------------------------------------");
    console.log(`${serverDef.name} listening to %s`, server.address());
    console.log("----------------------------------------");
  });
  serverDef.server = server;
});
