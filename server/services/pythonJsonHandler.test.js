const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const {
  parseStructuredError,
  runPythonJson,
} = require("./pythonJsonHandler");

class FakePythonShell extends EventEmitter {
  static callback = null;
  static latest = null;

  constructor() {
    super();
    FakePythonShell.latest = this;
  }

  send(payload) {
    this.payload = payload;
  }

  end(callback) {
    FakePythonShell.callback = callback;
  }
}

function createResponse() {
  return {
    headersSent: false,
    responses: [],
    status(status) {
      this.currentStatus = status;
      return this;
    },
    json(body) {
      this.responses.push({ status: this.currentStatus, body });
      this.headersSent = true;
    },
  };
}

function createLogger() {
  return {
    errors: [],
    debug() {},
    error(message) {
      this.errors.push(message);
    },
  };
}

test("parseStructuredError finds JSON after traceback text", () => {
  assert.deepEqual(
    parseStructuredError(
      'traceback detail\n{"code":500,"message":"missing probes.db"}'
    ),
    { code: 500, message: "missing probes.db" }
  );
});

test("runPythonJson waits for successful process completion", () => {
  const response = createResponse();
  const logger = createLogger();
  runPythonJson({
    PythonShell: FakePythonShell,
    script: "query_probe_names.py",
    payload: {},
    route: "/query-probe-names",
    response,
    logger,
  });

  FakePythonShell.latest.emit("message", { probes: ["rs1"] });
  assert.equal(response.responses.length, 0);
  FakePythonShell.callback(null, 0, null);
  assert.deepEqual(response.responses, [
    { status: 200, body: { probes: ["rs1"] } },
  ]);
});

test("runPythonJson returns and logs actionable stderr only once", () => {
  const response = createResponse();
  const logger = createLogger();
  runPythonJson({
    PythonShell: FakePythonShell,
    script: "query_probe_names.py",
    payload: {},
    route: "/query-probe-names",
    response,
    logger,
  });

  FakePythonShell.latest.emit("message", { probes: ["partial-result"] });
  const error = new Error("Python process exited with code 1");
  error.stderr = '{"code":500,"message":"missing probes.db"}';
  FakePythonShell.callback(error, 1, null);
  FakePythonShell.callback(error, 1, null);

  assert.deepEqual(response.responses, [
    {
      status: 500,
      body: { code: 500, message: "missing probes.db" },
    },
  ]);
  assert.match(logger.errors[0], /missing probes\.db/);
});

test("runPythonJson handles interpreter spawn errors only once", () => {
  const response = createResponse();
  const logger = createLogger();
  runPythonJson({
    PythonShell: FakePythonShell,
    script: "query_probe_names.py",
    payload: {},
    route: "/query-probe-names",
    response,
    logger,
  });

  FakePythonShell.latest.emit("error", new Error("spawn python3.13 ENOENT"));
  FakePythonShell.callback(
    new Error("process exited after failed spawn"),
    null,
    null
  );

  assert.deepEqual(response.responses, [
    {
      status: 500,
      body: { code: 500, message: "spawn python3.13 ENOENT" },
    },
  ]);
  assert.match(logger.errors[0], /spawn python3\.13 ENOENT/);
});
