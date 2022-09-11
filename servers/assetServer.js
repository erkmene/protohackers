class Session {
  constructor(conn, sessionId) {
    this.connection = conn;
    this.sessionId = sessionId;
    this.log = [];
    this.buffer = Buffer.from([]);
    this.intervalId = setInterval(() => {
      this.process();
    }, 500);
    console.log(this.sessionId, "START");
  }
  debug(...rest) {
    console.log(this.sessionId, ...rest);
  }
  streamIntoBuffer(input) {
    this.buffer = Buffer.concat([this.buffer, input]);
  }
  insert(timestamp, price) {
    const item = {
      timestamp,
      price,
    };
    this.log.push(item);
    return item;
  }
  query(start, end) {
    const items = this.log.filter((item) => {
      return item.timestamp >= start && item.timestamp <= end;
    });

    return Math.round(
      items.reduce((sum, current) => sum + current.price, 0) / items.length
    );
  }
  parseSequence(seq) {
    return [
      seq.subarray(0, 1).toString(),
      seq.readInt32BE(1),
      seq.readInt32BE(5),
    ];
  }
  process() {
    this.debug("PROCESS");
    while (this.buffer.length >= 9) {
      this.debug("REMAINING:", this.buffer.length);
      const currentSequence = this.buffer.subarray(0, 9);
      this.buffer = this.buffer.subarray(9);
      const parsed = this.parseSequence(currentSequence);
      switch (parsed[0]) {
        case "I":
          this.debug("INSERT", parsed[1], parsed[2]);
          this.insert(parsed[1], parsed[2]);
          break;
        case "Q":
          this.debug("QUERY", parsed[1], parsed[2]);
          const response = Buffer.alloc(4);
          response.writeInt32BE(this.query(parsed[1], parsed[2]));
          this.debug("RESPONSE", response);
          this.connection.write(response);
          break;
      }
    }
  }
  end() {
    clearTimeout(this.intervalId);
    this.debug("END");
  }
}

const sessions = {};

const assetServer = (conn) => {
  const serverName = "Asset Server";

  const remoteAddress = `${conn.remoteAddress}:${conn.remotePort}`;
  console.log("=========================================");
  console.log(`${serverName} CONNECTION from ${remoteAddress}`);
  const session = new Session(conn, remoteAddress);
  sessions[remoteAddress] = session;

  const onConnData = (d) => {
    console.log("REQUEST:");
    console.log("_____________");
    console.log(d);
    console.log("_____________");

    sessions[remoteAddress].streamIntoBuffer(d);
  };
  const onConnClose = () => {
    console.log(`${serverName} CLOSE ${remoteAddress}`);
    sessions[remoteAddress].end();
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

module.exports = assetServer;
