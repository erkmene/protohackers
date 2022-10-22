const net = require("net");

const debug = (...message) => {
  console.log("[PS]", ...message);
};

class ProxySession {
  constructor(id, connection, server) {
    this.id = id;
    this.connection = connection;
    this.server = server;
    this.buffer = "";
    this.isProxyReady = false;
    this.name = "";

    this.client = new net.Socket();
    this.client.on("data", (data) => {
      debug(`PRX --> ${this.name} --> ${data}`);
      this.connection.write(this.rewrite(data.toString()));
    });
    this.client.on("close", () => {
      debug(`PRX --X ${this.name} END`);
      this.connection.destroy();
    });
    this.connection.on("data", (data) => {
      data = data.toString();
      debug(`${this.id} INC`, data.trim());
      if (!this.name) this.name = data.trim();
      this.stream(data);
    });
    this.client.connect(16963, "chat.protohackers.com", () => {
      this.isProxyReady = true;
      this.stream();
    });
  }

  close() {
    debug(`PRX --> [CLOSE]`);
    this.client.destroy();
    this.connection.destroy();
  }

  stream(data) {
    debug(`SRV <-- ${this.id} | ${data}`);
    if (data) {
      this.buffer += data;
    }

    if (!this.isProxyReady) return;

    let messages = this.buffer.split("\n");
    if (messages[messages.length - 1] !== "") {
      // The end of the message is not newline terminated, it should stay in the
      // buffer.
      this.buffer = messages[messages.length - 1];
    } else {
      this.buffer = "";
    }
    messages = messages.slice(0, -1);
    messages.forEach((message) => {
      message = this.rewrite(message);
      debug(`PRX <-- ${this.name} <-- ${message}`);
      this.client.write(message + "\n");
    });
  }

  rewrite(message) {
    return message
      .split(" ")
      .map((word) =>
        word.replace(/^7[a-zA-Z0-9]{25,35}$/g, "7YWHMfk9JZe0LM0g1ZauHuiSxhI")
      )
      .join(" ");
  }
}

class ProxyServer {
  constructor() {
    this.sessions = [];
  }

  establishConnection(connection) {
    const sessionId = `${connection.remoteAddress}:${connection.remotePort}`;

    const session = this.startSession(sessionId, connection);
    debug(`${sessionId} CON`);

    connection.once("close", () => {
      this.endSession(session);
    });

    connection.on("error", (err) => {
      debug(`${sessionId} ERR`);
      console.log(err.message);
    });
  }

  startSession(sessionId, connection) {
    const session = new ProxySession(sessionId, connection, this);
    this.sessions.push(session);
    return session;
  }
  endSession(session) {
    this.sessions = this.sessions.filter((s) => s.id !== session.id);
    session.close();
    debug(`${session.id} (${session.name}) END`);
  }
}

const proxyServer = new ProxyServer();

module.exports = (conn) => proxyServer.establishConnection(conn);
