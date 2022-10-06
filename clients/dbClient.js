const udp = require("dgram");

// creating a client socket
const client = udp.createSocket("udp4");

client.on("message", function (msg, info) {
  console.log("Data received from server : " + msg.toString());
  console.log(
    "Received %d bytes from %s:%d\n",
    msg.length,
    info.address,
    info.port
  );
});

//sending msg
client.send(Buffer.from("version"), 9004, "localhost");
client.send(Buffer.from("hello=world"), 9004, "localhost");
client.send(Buffer.from("hello"), 9004, "localhost");
