const isPrime = (num) => {
  if (parseInt(num) != num) return false;
  for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
    if (num % i === 0) {
      return false;
    }
  }
  return num > 1;
};

const primeServer = (conn) => {
  const serverName = "Prime Server";

  const remoteAddress = `${conn.remoteAddress}:${conn.remotePort}`;
  console.log("=========================================");
  console.log(`${serverName} CONNECTION from ${remoteAddress}`);

  let buffer = "";

  const onConnData = (d) => {
    let dataString = d.toString();

    // Check whether there are other packets to wait for.
    if (!dataString.endsWith("\n")) {
      buffer += dataString;
      return;
    } else {
      dataString = buffer + dataString;
      buffer = "";
    }

    console.log("REQUEST:");
    console.log("_____________");
    console.log(dataString);
    console.log("_____________");

    const lines = dataString.trim().split("\n");
    const responses = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const dataParsed = JSON.parse(line);
        if (
          dataParsed.method === "isPrime" &&
          typeof dataParsed.number === "number"
        ) {
          console.log("Valid request: ", dataParsed);
          const response = JSON.stringify({
            method: "isPrime",
            prime: isPrime(dataParsed.number),
          });
          responses.push(response);
          console.log("Response: ", response);
        } else {
          console.log("+++", err.message);
          responses.push("!ERROR!");
          break;
        }
      } catch (err) {
        console.log("!!!", err.message);
        responses.push("!ERROR!");
        break;
      }
    }

    const response = responses.join("\n") + "\n";

    console.log("End response:");
    console.log("_____________");
    console.log(response);
    console.log("_____________");

    conn.write(response);
  };
  const onConnClose = () => {
    console.log(`${serverName} CLOSE ${remoteAddress}`);
    console.log("=========================================");
  };
  const onConnError = (err) => {
    console.log(`${serverName} ERROR ${remoteAddress}`);
    console.log(err.message);
  };

  conn.on("data", onConnData);
  conn.once("close", onConnClose);
  conn.on("error", onConnError);
};

module.exports = primeServer;
