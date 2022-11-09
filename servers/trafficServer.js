const EventEmitter = require("events");
const net = require("net");

const debug = (...message) => {
  console.log("[TS]", ...message);
};

class Client extends EventEmitter {
  static INIT_CAMERA = "IAmCamera";
  static INIT_DISPATCHER = "IAmDispatcher";
  static PLATE_RECEIVED = "Plate";

  constructor({ id, server, connection }) {
    super();
    Object.assign(this, { id, server, connection });
    this.connection.on("data", (data) => this.onData(data));
    this.connection.on("close", () => this.onClose());
    this.instance = null;

    this.camera = null;
    this.dispatcher = null;

    this.heartbeatIntervalId = null;

    this.buffer = Buffer.alloc(0);

    debug(`${this.id} INI`);
  }

  onData(data) {
    debug(`${this.id} -->`, data);
    this.addToBuffer(data);
    this.parseBuffer();
  }

  onClose() {
    debug(`TRF --X ${this.id} END`);
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    this.server.removeClient(this);
    this.connection.destroy();
  }

  addToBuffer(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  parseBuffer() {
    const buffer = this.buffer;
    try {
      const type = buffer.readUInt8();
      switch (type) {
        case 0x20:
          // Plate (C->S)
          debug(`${this.id} --> Plate`);
          const plateLength = buffer.readUInt8(1);
          const plateObj = {
            client: this,
            plate: buffer.subarray(2, 2 + plateLength).toString("utf8"),
            timestamp: buffer
              .subarray(2 + plateLength, 2 + plateLength + 4)
              .readUInt32BE(),
          };
          debug({ plate: plateObj.plate, timestamp: plateObj.timestamp });
          this.buffer = buffer.subarray(2 + plateLength + 4);
          if (!this.camera) {
            this.disconnectWithError("Only cameras can send plates.");
          } else {
            this.emit(Client.PLATE_RECEIVED, plateObj);
          }
          break;
        case 0x40:
          // WantHeartbeat (C->S)
          debug(`${this.id} --> WantHeartbeat`);
          if (this.sendingHeartbeat) {
            this.disconnectWithError("Heartbeat already requested.");
          } else {
            const interval = buffer.readUInt32BE(1);
            if (interval) {
              this.heartbeatIntervalId = setInterval(() => {
                this.sendHeartbeat();
              }, (interval / 10) * 1000); // deciseconds
            }
          }
          this.buffer = buffer.subarray(5);
          break;
        case 0x80:
          // IAmCamera (C->S)
          debug(`${this.id} --> IAmCamera`);
          if (this.camera || this.dispatcher) {
            this.disconnectWithError("Client already initialized.");
          } else {
            const cameraObj = {
              client: this,
              roadId: buffer.readUInt16BE(1),
              mile: buffer.readUInt16BE(3),
              limit: buffer.readUInt16BE(5),
            };
            debug({
              roadId: cameraObj.roadId,
              mile: cameraObj.mile,
              limit: cameraObj.limit,
            });
            this.emit(Client.INIT_CAMERA, cameraObj);
          }
          this.buffer = buffer.subarray(7);
          break;
        case 0x81:
          // IAmDispatcher (C->S)
          debug(`${this.id} --> IAmDispatcher`);
          const numRoads = buffer.readUInt8(1);
          const roadIds = [];
          for (let i = 0; i < numRoads; i++) {
            roadIds.push(buffer.readUInt16BE(2 + i * 2));
          }
          const dispatcherObj = {
            client: this,
            roadIds,
          };
          debug({ roadIds });
          this.buffer = buffer.subarray(1 + 1 + numRoads * 2);
          if (this.camera || this.dispatcher) {
            this.disconnectWithError("Client already initialized.");
          } else {
            this.emit(Client.INIT_DISPATCHER, dispatcherObj);
          }
          break;
        default:
          this.disconnectWithError("Invalid packet");
      }
    } catch (err) {
      debug(`${this.id} ?-> ERROR`, err.message);
    }
    if (this.buffer.length > 0) {
      setTimeout(() => this.parseBuffer(), 100);
    }
  }

  disconnectWithError(message) {
    this.send(
      Buffer.from([
        0x10,
        message.length,
        ...message.split("").map((_c, i) => message.charCodeAt(i)),
      ])
    );
    this.onClose();
    debug(`${this.id} ERR ${message}`);
  }

  sendTicket({
    plate,
    roadId,
    mile1,
    timestamp1,
    mile2,
    timestamp2,
    speed,
    days,
    limit,
  }) {
    debug(
      `${this.id} <-- TICKET ${plate} ${timestamp1 / 86400} ${
        timestamp2 / 86400
      }`
    );
    debug({
      plate,
      roadId,
      mile1,
      timestamp1,
      mile2,
      timestamp2,
      speed,
      days,
      limit,
    });
    const buffer = Buffer.alloc(1 + 1 + plate.length + 2 + 2 + 4 + 2 + 4 + 2);
    buffer.writeUInt8(0x21);
    buffer.writeUInt8(plate.length, 1);
    buffer.write(plate, 2);
    buffer.writeUInt16BE(roadId, 2 + plate.length);
    buffer.writeUInt16BE(mile1, 2 + plate.length + 2);
    buffer.writeUInt32BE(timestamp1, 2 + plate.length + 2 + 2);
    buffer.writeUInt16BE(mile2, 2 + plate.length + 2 + 2 + 4);
    buffer.writeUInt32BE(timestamp2, 2 + plate.length + 2 + 2 + 4 + 2);
    buffer.writeUInt16BE(speed, 2 + plate.length + 2 + 2 + 4 + 2 + 4);
    this.send(buffer);
  }

  sendHeartbeat() {
    debug(`${this.id} <-- ♥`);
    this.send(Buffer.from([0x41]));
  }

  send(buffer) {
    try {
      if (!this.connection.destroyed) {
        this.connection.write(buffer);
      }
    } catch (err) {
      debug(`${this.id} <-? ERROR`, err.message);
    }
  }
}

class RoadNetwork {
  constructor() {
    this.clients = {};
    this.roads = {};
    this.dispatchers = {};
    this.ticketedPlatesByDay = {};
    this.ticketedPlatesByTimestamp = {};
    this.pendingTicketsByRoad = {};
  }

  addClient(client) {
    this.clients[client.id] = { client };
    client.on(Client.INIT_CAMERA, (def) => this.addCamera(def));
    client.on(Client.INIT_DISPATCHER, (def) => this.addDispatcher(def));
    client.on(Client.PLATE_RECEIVED, (def) => this.recordPlate(def));
  }

  removeClient(client) {
    if (client.camera) {
      this.removeCamera(client.camera);
    } else if (client.dispatcher) {
      this.removeDispatcher(client.dispatcher);
    }
    Reflect.deleteProperty(this.clients, client.id);
  }

  getRoad(roadId) {
    if (!this.roads[roadId]) {
      this.roads[roadId] = new Road({ id: roadId });
    }
    return this.roads[roadId];
  }

  addCamera({ client, roadId, mile, limit }) {
    const camera = new Camera({ client, roadId, mile, limit });
    const road = this.getRoad(roadId);
    road.addCamera(camera);
    camera.road = road;
    client.camera = camera;
  }

  removeCamera(camera) {
    camera.road.removeCamera(camera);
    debug("Removed camera", camera.id);
  }

  recordPlate({ client, plate, timestamp }) {
    const camera = client.camera;
    const road = camera.road;
    road.recordPlate({
      camera,
      plate,
      timestamp,
    });
    const tickets = road.checkTickets(plate);
    tickets.forEach((ticket) => this.issueTicket(ticket));
  }

  issueTicket(ticket) {
    ticket.days.forEach((day) => {
      if (!this.ticketedPlatesByDay[day]) {
        this.ticketedPlatesByDay[day] = [];
      }
    });

    const plateTicketedForTheseDays = [...ticket.days].reduce(
      (result, day) =>
        result || this.ticketedPlatesByDay[day].includes(ticket.plate),
      false
    );
    if (!plateTicketedForTheseDays) {
      const road = ticket.road;
      if (road.dispatchers[0]) {
        ticket.days.forEach((day) => {
          this.ticketedPlatesByDay[day].push(ticket.plate);
        });
        road.dispatchers[0].client.sendTicket(ticket);
      } else {
        if (!this.pendingTicketsByRoad[road.id]) {
          this.pendingTicketsByRoad[road.id] = [];
        }
        this.pendingTicketsByRoad[road.id].push(ticket);
      }
    }
  }

  addDispatcher({ client, roadIds }) {
    const dispatcher = new Dispatcher({ client, roadIds });
    client.dispatcher = dispatcher;
    roadIds.forEach((roadId) => {
      const road = this.getRoad(roadId);
      road.addDispatcher(dispatcher);
      if (this.pendingTicketsByRoad[road.id]) {
        while (this.pendingTicketsByRoad[road.id].length > 0) {
          const ticket = this.pendingTicketsByRoad[road.id].pop();
          this.issueTicket(ticket);
        }
      }
    });
  }

  removeDispatcher(dispatcher) {
    dispatcher.roadIds.forEach((roadId) => {
      const road = this.getRoad(roadId);
      road.removeDispatcher(dispatcher);
    });
    debug("Removed dispatcher", dispatcher.id);
  }
}

class Road {
  constructor({ id }) {
    this.id = id;
    this.miles = {};
    this.cameras = [];
    this.limit = null;
    this.dispatchers = [];
    this.log = {};
  }

  addCamera(camera) {
    this.limit = camera.limit;
    this.cameras.push(camera);
    this.cameras.sort((a, b) => a.mile - b.mile);
  }

  removeCamera(camera) {
    this.cameras = this.cameras.filter((c) => c.id !== camera.id);
    this.cameras.sort((a, b) => a.mile - b.mile);
  }

  addDispatcher(dispatcher) {
    this.dispatchers.push(dispatcher);
  }

  removeDispatcher(dispatcher) {
    this.dispatchers = this.dispatchers.filter((c) => c.id !== dispatcher.id);
  }

  recordPlate({ camera, plate, timestamp }) {
    if (!this.log[plate]) {
      this.log[plate] = {};
    }
    this.log[plate][timestamp] = camera.mile;
  }

  checkTickets(plate) {
    const timestamps = Object.keys(this.log[plate]).sort();
    return timestamps.reduce((tickets, timestamp, i) => {
      if (i < timestamps.length - 1) {
        const nextTimestamp = timestamps[i + 1];
        const time = nextTimestamp - timestamp;
        const mile1 = this.log[plate][timestamp];
        const mile2 = this.log[plate][nextTimestamp];
        const distance = mile2 - mile1;
        const speed = Math.abs((distance / time) * 60 * 60);
        if (speed > this.limit) {
          tickets.push({
            plate,
            roadId: this.id,
            road: this,
            mile1,
            timestamp1: timestamp,
            mile2,
            timestamp2: nextTimestamp,
            speed: Math.floor(speed * 100),
            days: new Set([
              Math.floor(timestamp / 86400),
              Math.floor(nextTimestamp / 86400),
            ]),
            limit: this.limit,
          });
        }
      }
      return tickets;
    }, []);
  }
}

class Camera {
  constructor({ client, roadId, mile, limit }) {
    Object.assign(this, { roadId, mile, limit, client });
    this.id = `${this.roadId}-${this.mile}`;
  }
}

class Dispatcher {
  constructor({ client, roadIds }) {
    Object.assign(this, { client, roadIds });
    this.id = roadIds.join("-");
  }
}

class TrafficServer {
  constructor() {
    this.network = new RoadNetwork();
  }

  establishConnection(connection) {
    const id = `${connection.remoteAddress}:${connection.remotePort}`;
    const client = new Client({ id, server: this, connection });
    this.network.addClient(client);
  }

  removeClient(client) {
    this.network.removeClient(client);
    client.removeAllListeners();
  }
}

const trafficServer = new TrafficServer();

module.exports = (conn) => trafficServer.establishConnection(conn);
