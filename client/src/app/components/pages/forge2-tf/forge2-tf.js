import React from "react";
// import Brand from './panels/brand';
import Settings from "./panels/settings";
import Viewer from "./panels/viewer";
import { Row, Col } from "react-bootstrap";
import * as AppConst from "../../../appConstants";
import { ErrorModal } from "../../controls/error-modal/error-modal";

export default class FORGE2TF extends React.Component {
  constructor(props) {
    super(props);
    this.defaultSettings = {
      array: AppConst.settings.defaults.array,
      sample: AppConst.settings.defaults.sample,
      probes: AppConst.settings.defaults.probes,
      probesCount: AppConst.settings.defaults.probes.length,
      probesIndex: 0,
      currentProbe: AppConst.settings.defaults.probes[0],
      padding: AppConst.settings.defaults.padding,
      smoothing: AppConst.settings.defaults.smoothing,
      annotationType: AppConst.settings.defaults.annotationType,
      signalType: AppConst.settings.defaults.signalType,
      viewMode: AppConst.settings.defaults.viewMode,
      snpFilter: AppConst.settings.defaults.snpFilter,
      errorModal: AppConst.settings.defaults.errorModal,
    };

    const queryString = require("query-string");
    const parsed = queryString.parse(location.search);
    if (parsed.array !== undefined) {
      var array = parsed.array;
      if (Object.keys(AppConst.settings.arrays).indexOf(array) != -1) {
        this.defaultSettings.array = array;
      }
    }
    if (parsed.sample !== undefined) {
      var sample = parsed.sample;
      if (Object.keys(AppConst.settings.samples).indexOf(sample) != -1) {
        this.defaultSettings.sample = sample;
      }
    }
    if (parsed.probes !== undefined) {
      this.defaultSettings.probes = parsed.probes.split(",");
      this.defaultSettings.probesCount = parsed.probes.split(",").length;
      this.defaultSettings.currentProbe = parsed.probes.split(",")[0];
    }
    if (parsed.padding !== undefined) {
      var padding = parseInt(parsed.padding);
      console.log(padding, [20, 50, 100, 200, 500].indexOf(padding));
      if ([20, 50, 100, 200, 500].indexOf(padding) != -1) {
        this.defaultSettings.padding = padding;
      }
    }
    if (parsed.smoothing !== undefined) {
      var smoothing = parseInt(parsed.smoothing);
      console.log(smoothing, [0, 1, 2, 3, 5].indexOf(smoothing));
      if ([0, 1, 2, 3, 5].indexOf(smoothing) != -1) {
        this.defaultSettings.smoothing = smoothing;
      }
    }

    this.state = {
      brandTitle: "FORGE2-TF",
      brandSubtitle: "TF-centric SNP array browser",
      settings: this.defaultSettings,
      settingsChangeStart: false,
      plotKey: 0,
      plotKeyPrefix: "plot-",
      tfTableKey: 0,
      tfTableKeyPrefix: "tfTable-",
      errorModal: this.defaultSettings.errorModal,
    };
    this.updateSettings = this.updateSettings.bind(this);
    this.updateSettingsChange = this.updateSettingsChange.bind(this);
    this.randomInt = this.randomInt.bind(this);
    this.updateCurrentProbe = this.updateCurrentProbe.bind(this);
    this.updateCloseErrorModal = this.updateCloseErrorModal.bind(this);
    this.updateShowErrorModal = this.updateShowErrorModal.bind(this);
  }

  componentDidMount() {
    console.log("initial settings...");
    console.log(this.state.settings);
  }

  updateSettings(settings) {
    this.setState(
      {
        settingsChangeStart: true,
        settings: settings,
        plotKey: this.state.plotKeyPrefix + this.randomInt(0, 1000000),
        tfTableKey: this.state.tfTableKeyPrefix + this.randomInt(0, 1000000),
      },
      function () {
        console.log("updated global settings...");
        console.log(this.state.settings);
      }
    );
  }

  updateSettingsChange(changeState, callback) {
    this.setState(
      {
        settingsChangeStart: changeState,
      },
      function () {
        if (callback) callback();
      }
    );
  }

  updateCurrentProbe(direction) {
    var nextProbeIndex = null;
    var previousSettings = this.state.settings;
    //console.log("app - updateCurrentProbe() - previousSettings", previousSettings);
    switch (direction) {
      case "previous":
        nextProbeIndex =
          previousSettings.probesIndex - 1 >= 0
            ? (previousSettings.probesIndex - 1) % previousSettings.probesCount
            : previousSettings.probesCount - 1;
        break;
      case "next":
        nextProbeIndex =
          (previousSettings.probesIndex + 1) % previousSettings.probesCount;
        break;
      default:
        break;
    }
    var nextSettings = JSON.parse(JSON.stringify(this.state.settings));
    nextSettings["probesIndex"] = nextProbeIndex;
    nextSettings["currentProbe"] = this.state.settings.probes[nextProbeIndex];
    //console.log("app - updateCurrentProbe() - nextSettings", nextSettings);
    this.setState(
      {
        settingsChangeStart: true,
        settings: nextSettings,
        plotKey: this.state.plotKeyPrefix + this.randomInt(0, 1000000),
        tfTableKey: this.state.tfTableKeyPrefix + this.randomInt(0, 1000000),
      },
      function () {
        console.log("updated global settings...");
        console.log(this.state.settings);
      }
    );
  }

  randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }

  updateShowErrorModal() {
    this.setState(
      {
        errorModal: true,
      },
      function () {
        console.log("show error modal...");
      }
    );
  }

  updateCloseErrorModal() {
    this.setState(
      {
        errorModal: false,
      },
      function () {
        console.log("close error modal...");
      }
    );
  }

  render() {
    return (
      <Row>
        <ErrorModal
          visible={this.state.errorModal}
          closeErrorModal={this.updateCloseErrorModal}
        />
        <Col className="left-side p-2">
          <div className="ml-4 mr-3">
            <Settings
              id="settings"
              ref="settings"
              title="Settings"
              settings={this.state.settings}
              updateSettings={this.updateSettings}
              updateShowErrorModal={this.updateShowErrorModal}
            />
          </div>
        </Col>
        <Col className="right-side pl-0">
          <Viewer
            id="viewer"
            settings={this.state.settings}
            settingsChangeStart={this.state.settingsChangeStart}
            updateSettingsChange={this.updateSettingsChange}
            updateCurrentProbe={this.updateCurrentProbe}
            plotKey={this.state.plotKeyPrefix + this.randomInt(0, 1000000)}
            tfTableKey={
              this.state.tfTableKeyPrefix + this.randomInt(0, 1000000)
            }
            updateShowErrorModal={this.updateShowErrorModal}
          />
        </Col>
      </Row>
    );
  }
}
