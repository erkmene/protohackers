const debug = (...message) => {
  console.log("[DB]", ...message);
};

const store = {
  version: "UDP/DB v1.0.0",
};

const setData = (key, value) => {
  store[key] = value;
};
const getData = (key) => {
  return store[key];
};

const dbServer = (server, msg, info) => {
  msg = msg.toString();
  debug("<--", msg.toString());

  const parts = msg.split("=");
  if (parts.length > 1) {
    if (parts[0] !== "version") {
      setData(parts[0], parts.slice(1).join("="));
    }
  } else {
    const key = parts[0];
    const value = getData(key) || "";
    const message = `${key}=${value}`;
    server.send(
      `${key}=${value}`,
      info.port,
      info.address,
      function (err, bytes) {
        if (err) {
          debug("--> ERR", `${info.address}:${info.port}`);
          console.log(err);
        } else {
          debug("-->", `${info.address}:${info.port}`, message);
        }
      }
    );
  }
};

module.exports = dbServer;
