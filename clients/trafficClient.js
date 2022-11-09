// DISREGARD: Simple test client with arbitrary test connections & data.

const net = require("net");

sleep = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const clients = [];

for (let i = 0; i < 3; i++) {
  const client = new net.Socket();
  clients.push(client);
  client.on("data", (data) => {
    console.log(`[C${i}] Received:`, data);
  });
  client.on("close", () => {
    console.log(`[C${i}] Connection closed:`);
  });
}

(async () => {
  clients[0].connect(9006, "127.0.0.1", async function () {
    const client = clients[0];
    console.log("0: Camera 1");
    client.write(Buffer.from([0x80, 0x00, 0x7b, 0x00, 0x08, 0x00, 0x3c]));
    console.log("0: Sent IAmCamera");
    await sleep(1000);
    client.write(
      Buffer.from([0x20, 0x04, 0x55, 0x4e, 0x31, 0x58, 0x00, 0x00, 0x00, 0x00])
    );
    client.write(
      Buffer.from([0x20, 0x04, 0x55, 0x4e, 0x31, 0x58, 0x01, 0x00, 0x00, 0x00])
    );
    client.write(
      Buffer.from([0x20, 0x04, 0x55, 0x4e, 0x31, 0x58, 0x01, 0x00, 0x00, 0x10])
    );
    console.log("0: Sent Plate");
    await sleep(2000);
  });
})();

(async () => {
  clients[1].connect(9006, "127.0.0.1", async function () {
    const client = clients[1];
    console.log("1: Camera 2");
    client.write(Buffer.from([0x80, 0x00, 0x7b, 0x00, 0x09, 0x00, 0x3c]));
    console.log("1: Sent IAmCamera");
    await sleep(1500);
    client.write(
      Buffer.from([0x20, 0x04, 0x55, 0x4e, 0x31, 0x58, 0x00, 0x00, 0x00, 0x2d])
    );
    client.write(
      Buffer.from([0x20, 0x04, 0x55, 0x4e, 0x31, 0x58, 0x01, 0x00, 0x00, 0x01])
    );
    client.write(
      Buffer.from([0x20, 0x04, 0x55, 0x4e, 0x31, 0x58, 0x01, 0x00, 0x00, 0x11])
    );
    console.log("1: Sent Plate");
    await sleep(2500);
    client.write(Buffer.from([0x40, 0x00, 0x00, 0x00, 0x0a]));
    console.log("1: Sent heartbeat");
  });
})();

(async () => {
  clients[2].connect(9006, "127.0.0.1", async function () {
    const client = clients[2];
    console.log("3: Ticket Dispatcher");
    client.write(Buffer.from([0x81, 0x01]));
    await sleep(100);
    client.write(Buffer.from([0x00, 0x7b]));
    console.log("3: Sent IAmDispatcher");
  });
})();
