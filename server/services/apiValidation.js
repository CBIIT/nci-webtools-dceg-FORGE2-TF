const { body } = require("express-validator");

// available arrays in /data
const availableArrays = ["All"];

const queryProbeNamesValidation = [
  body("settings.array").isString().isIn(availableArrays).trim().escape(),
];

const queryAggregateValidation = [
  body("settings.currentProbe")
    .isString()
    .matches(/^rs\d+$/)
    .trim()
    .escape(),
  body("settings.array").isString().isIn(availableArrays).trim().escape(),
  body("settings.sample")
    .isString()
    .matches(/^[A-Za-z0-9_]+-[A-Za-z0-9_]+$/)
    .trim()
    .escape(),
];

const queryTfSummaryValidation = [
  body("tf_summary.array").isString().isIn(availableArrays).trim().escape(),
];

const queryTfSummaryGraphValidation = [
  body("tf_summary.output")
    .isString()
    .matches(/^[A-Za-z0-9_.:\-]+\.pdf$/) 
    .withMessage("Invalid output filename"),
];

const queryTfAggregateSummaryValidation = [
  body("tf_aggregate_summary.array")
    .isString()
    .isIn(availableArrays)
    .trim()
    .escape(),
  body("tf_aggregate_summary.sample")
    .isString()
    .matches(/^[A-Za-z0-9_.\-]+$/)
    .withMessage("Invalid TF model name")
    .trim()
    .escape(),
];

const queryTfProbeOverlapSummaryValidation = [
  body("tf_probe_overlap_summary.tfModel").isString().trim().escape(),
];

module.exports = {
  queryProbeNamesValidation,
  queryAggregateValidation,
  queryTfSummaryValidation,
  queryTfSummaryGraphValidation,
  queryTfAggregateSummaryValidation,
  queryTfProbeOverlapSummaryValidation,
};
