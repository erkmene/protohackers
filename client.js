// DISREGARD: Simple test client with arbitrary test connections & data.

const net = require("net");
const client = new net.Socket();

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
client.connect(9002, "127.0.0.1", function () {
  console.log("Connected");
  client.write(Buffer.from("490000303900000065", "hex"));
  client.write(Buffer.from("490000303a00000066", "hex"));
  client.write(Buffer.from("490000303b00000064", "hex"));
  client.write(Buffer.from("490000a00000000005", "hex"));
  client.write(Buffer.from("510000300000004000", "hex"));
});
client.on("data", function (data) {
  console.log("Received: " + data);
  client.destroy(); // kill client after server's response
});
client.on("close", function () {
  console.log("Connection closed");
});
