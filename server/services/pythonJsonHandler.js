function parseStructuredError(stderr) {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      if (
        parsed &&
        Number.isInteger(parsed.code) &&
        typeof parsed.message === "string"
      ) {
        return parsed;
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }

  return null;
}

function runPythonJson({
  PythonShell,
  script,
  payload,
  route,
  response,
  logger,
}) {
  const pythonProcess = new PythonShell(script);
  const stderr = [];
  let result;
  let settled = false;

  const respondWithError = (err, code, signal) => {
    if (settled) return;
    settled = true;

    const stderrText = [err.stderr, ...stderr].filter(Boolean).join("\n");
    const structuredError =
      parseStructuredError(stderrText) || parseStructuredError(err.message);
    const status =
      structuredError &&
      structuredError.code >= 400 &&
      structuredError.code <= 599
        ? structuredError.code
        : 500;
    const message =
      structuredError?.message ||
      stderrText.trim() ||
      err.message ||
      "Python process failed without an error message";

    logger.error(
      `${route} failed (exitCode=${code ?? "unknown"}, signal=${
        signal ?? "none"
      }): ${message}`
    );
    if (!response.headersSent) {
      response.status(status).json({ code: status, message });
    }
  };

  pythonProcess.on("message", (message) => {
    result = message;
  });
  pythonProcess.on("stderr", (message) => {
    stderr.push(message);
  });
  pythonProcess.on("error", (err) => {
    respondWithError(err);
  });

  pythonProcess.send(payload);
  pythonProcess.end((err, code, signal) => {
    if (settled) return;
    if (err) {
      respondWithError(err, code, signal);
      return;
    }
    settled = true;

    if (result === undefined) {
      const message = "Python process completed without returning JSON";
      logger.error(`${route} failed: ${message}`);
      if (!response.headersSent) {
        response.status(500).json({ code: 500, message });
      }
      return;
    }

    logger.debug(route, result);
    if (!response.headersSent) {
      response.status(200).json(result);
    }
  });
}

module.exports = { parseStructuredError, runPythonJson };
