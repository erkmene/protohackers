const echoServer = (conn) => {
  const serverName = "Echo Server";

  const remoteAddress = `${conn.remoteAddress}:${conn.remotePort}`;
  console.log("=========================================");
  console.log(`${serverName} CONNECTION from ${remoteAddress}`);

  const onConnData = (d) => {
    console.log("RESPONSE:");
    console.log(d.toString());
    conn.write(d);
  };
  const onConnClose = () => {
    console.log(`${serverName} CLOSE ${remoteAddress}`);
  };
  const onConnError = (err) => {
    console.log(`${serverName} ERROR ${remoteAddress}`);
    console.log(err.message);
  };

  conn.on("data", onConnData);
  conn.once("close", onConnClose);
  conn.on("error", onConnError);
};

module.exports = echoServer;
