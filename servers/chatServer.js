const debug = (...message) => {
  console.log("[CS]", ...message);
};

class ChatSession {
  constructor(id, connection, server) {
    this.id = id;
    this.name = null;
    this.connection = connection;
    this.server = server;
    this.buffer = "";
  }

  stream(data) {
    debug(`SRV<-- ${this.name} | ${data}`);
    this.buffer += data;
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
      this.server.parseMessageFromSession(message, this);
    });
  }
}

class ChatServer {
  constructor() {
    this.sessions = [];
  }

  establishConnection(connection) {
    const sessionId = `${connection.remoteAddress}:${connection.remotePort}`;

    const session = this.startSession(sessionId, connection);
    debug(`${sessionId} CON`);

    connection.on("data", (data) => {
      debug(`${sessionId} REQ`, data);
      this.parseData(session, data);
    });

    connection.once("close", () => {
      debug(`${sessionId} END`);
      this.endSession(session);
    });

    connection.on("error", (err) => {
      debug(`${sessionId} ERR`);
      console.log(err.message);
    });

    this.sendWelcomeMessage(session);
  }

  startSession(sessionId, connection) {
    const session = new ChatSession(sessionId, connection, this);
    this.sessions.push(session);
    return session;
  }
  endSession(session) {
    this.sessions = this.sessions.filter((s) => s.id !== session.id);
    session.connection.destroy();
    if (session.name) {
      this.sendToJoined(`* ${session.name} left.`, session);
    }
  }
  getSession(sessionId) {
    return this.sessions.reduce((session, current) => {
      return session || (current.id === sessionId ? current : null);
    }, null);
  }

  sendMessage(session, message) {
    debug(`MSG--> ${session.name} | ${message}`);
    session.connection.write(message + "\n");
  }
  sendWelcomeMessage(session) {
    this.sendMessage(session, "welcome. please type your username:");
  }
  sendToJoined(message, except) {
    this.sessions
      .filter((session) => session.name && session.id !== except.id)
      .forEach((session) => {
        this.sendMessage(session, message);
      });
  }
  sendPresenceInformation(newSession) {
    const present = [];
    this.sessions.forEach((session) => {
      if (session.name != null && session.id !== newSession.id) {
        this.sendMessage(session, `* ${newSession.name} entered.`);
        present.push(session.name);
      }
    });
    if (present.length > 0) {
      this.sendMessage(newSession, `* you see: ${present.join(", ")}.`);
    } else {
      this.sendMessage(newSession, `* you are alone here.`);
    }
  }

  parseData(session, data) {
    data = data.toString();

    debug(`${session.id} INC`, data.trim());
    session.stream(data);
  }

  parseMessageFromSession(message, session) {
    if (!session.name) {
      debug(`${session.id} USR`, message);
      if (/^[A-Za-z0-9]+$/.test(message)) {
        session.name = message;
        this.sendPresenceInformation(session);
      } else {
        this.sendMessage(session, "go away.");
        this.endSession(session);
      }
    } else {
      debug(`${session.id} MSG`, `[${session.name}] ${message}`);
      this.sendToJoined(`[${session.name}] ${message}`, session);
    }
  }
}

const chatServer = new ChatServer();

module.exports = (conn) => chatServer.establishConnection(conn);
