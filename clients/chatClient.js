// DISREGARD: Simple test client with arbitrary test connections & data.

const net = require("net");
const client = new net.Socket();
const client2 = new net.Socket();
const client3 = new net.Socket();

// client.connect(9001, "127.0.0.1", function () {
//   console.log("Connected");
//   client.write('{"method":"isPrime","number":395807}');
// });
// client.connect(9001, "127.0.0.1", function () {
//   console.log("Connected");
//   client.write(
//     `{"method":"isPrime","number":971111}\n{"method":"isPrime","number":`
//   );
//   client.write(`971111}\n`);
// });
// client.connect(9002, "127.0.0.1", function () {
//   console.log("Connected");
//   client.write(Buffer.from("490000303900000065", "hex"));
//   client.write(Buffer.from("490000303a00000066", "hex"));
//   client.write(Buffer.from("490000303b00000064", "hex"));
//   client.write(Buffer.from("490000a00000000005", "hex"));
//   client.write(Buffer.from("510000300000004000", "hex"));
// });

const send = (data) => {};

sleep = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

client.on("data", function (data) {
  console.log("1: Received: " + data);
});
client.on("close", function () {
  console.log("1: Connection closed");
});
client.connect(9003, "127.0.0.1", async function () {
  console.log("1: Connected");
  client.write("alice\n");
  console.log("1: Sent username");
  await sleep(500);
  client.write("hello.\n");
  console.log("1: Sent message");
  await sleep(2500);
  client.destroy();
});

client2.on("data", function (data) {
  console.log("2: Received: " + data);
});
client2.on("close", function () {
  console.log("2: Connection closed");
});

(async () => {
  client2.connect(9003, "127.0.0.1", async function () {
    console.log("2: Connected");
    await sleep(1000);
    client2.write("bob\n");
    console.log("2: Sent username");
    await sleep(1000);
    client2.write("HEY!!\n");
    console.log("2: Sent message");
  });
})();

client3.on("data", function (data) {
  console.log("3: Received: " + data);
});
client3.on("close", function () {
  console.log("3: Connection closed");
});

(async () => {
  client3.connect(9003, "127.0.0.1", async function () {
    console.log("3: Connected");
    await sleep(1250);
    client3.write("mike\n");
    console.log("3: Sent username");
    await sleep(1000);
    client3.write("HEY!!\n");
    console.log("3: Sent message");
  });
})();
