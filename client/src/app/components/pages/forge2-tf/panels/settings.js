import React from "react";
import {
  Button,
  ButtonGroup,
  FormGroup,
  FormControl,
  Form,
} from "react-bootstrap";
import Brand from "./brand";
import * as AppConst from "../../../../appConstants";
import axios from "axios";

class Settings extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      array: this.props.settings.array,
      sample: this.props.settings.sample,
      probes: this.props.settings.probes,
      probesString: this.props.settings.probes.join(),
      probesCount: this.props.settings.probesCount,
      probesIndex: this.props.settings.probesIndex,
      currentProbe: this.props.settings.currentProbe,
      padding: this.props.settings.padding,
      smoothing: this.props.settings.smoothing,
      annotationType: this.props.settings.annotationType,
      signalType: this.props.settings.signalType,
      viewMode: this.props.settings.viewMode,
      snpFilter: this.props.settings.snpFilter,
    };
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.renderSettings = this.renderSettings.bind(this);
    this.handleSlideStop = this.handleSlideStop.bind(this);
    console.log("probesString", this.state.probesString);
    console.log("snpFilter", this.state.snpFilter);
  }

  handleKeyPress(event) {
    if (event.key == "Enter") {
      this.renderSettings();
    }
  }

  handleInputChange(event, customName, mouseoutFlag) {
    const target = event.target;
    var value = mouseoutFlag
      ? null
      : target.type === "checkbox"
      ? target.checked
      : target.value;
    const name = customName ? customName : target.name;
    //console.log("name", name);
    //console.log("value", value);

    if (name == "padding") {
      value = parseInt(value);
    }

    if (name == "probes") {
      var probesString = value;
      this.setState({
        probesString: value,
      });
    } else {
      this.setState(
        {
          [name]: value,
        },
        function () {
          if (
            target.type === "button" ||
            target.type === "select-one" ||
            target.type === "checkbox"
          ) {
            document.activeElement.blur();
            if (name == "render") {
              this.renderSettings();
            }
            if (
              name == "sample" ||
              name == "array" ||
              name == "annotationType" ||
              name == "signalType" ||
              name == "viewMode"
              // name == 'snpFilter'
            ) {
              this.renderSettings();
            }
          }
        }
      );
    }
  }

  async handlePing() {
    axios.get("api/ping").then(
      (res) => {
        console.log("result", res);
        window.alert(`server status: ${res.data}`);
      },
      (err) => {
        console.log("PING ERROR");
        console.log("error response : ", err);
        window.alert(`server status: PING ERROR`);
        this.props.updateShowErrorModal();
      }
    );
  }

  componentDidMount() {
    $("#settings-panel-padding-slider")
      .slider({})
      .on("slideStop", this.handleSlideStop)
      .data("slider");
    $("#settings-panel-smoothing-slider")
      .slider({})
      .on("slideStop", this.handleSlideStop)
      .data("slider");
  }

  handleSlideStop(event) {
    document.activeElement.blur();
    var value = event.target.value;
    var name = event.target.name;
    if (name == "padding") {
      var padding = parseInt([20, 50, 100, 200, 500][value]);
      this.setState(
        {
          padding: padding,
        },
        function () {
          this.renderSettings();
        }
      );
    } else if (name == "smoothing") {
      var smoothing = parseInt(AppConst.settings.smoothings[value]);
      this.setState(
        {
          smoothing: smoothing,
        },
        function () {
          this.renderSettings();
        }
      );
    }
  }

  renderSettings() {
    console.log("rendering settings in current state...");
    // var query_probe_names =
    //   'https://forge2-tf.altiusinstitute.org/assets/services/query_probe_names.py';
    var query_probe_names = "api/query-probe-names";
    var probesArray = this.state.probesString.split(/[,|\n|\r\n]/);
    var uniq = (arr) => Array.from(new Set(arr));
    let uniqProbesArray = uniq(probesArray);
    let filteredProbesArray = uniqProbesArray.filter(function (el) {
      return el;
    });
    probesArray = filteredProbesArray;
    console.log("probesArray", probesArray);
    if (probesArray) {
      var settings = {
        array: this.state.array,
        probes: probesArray,
        snpFilter: this.state.snpFilter,
      };
      var probesCount = probesArray.length;
      var currentProbe = probesArray[0];
      axios.post(query_probe_names, { settings }).then(
        (res) => {
          console.log("settings - handleInputChange() - result");
          console.log(res.data);
          var filteredByNameProbesArray = res.data.probes;
          var probesCount = filteredByNameProbesArray.length;
          // comment-out truncate snippet below- updated SQLite version to support 1000+ search terms
          // filter list further down to 1000 probes max. -- adjust UI text
          // if (probesCount > 1000) {
          //   filteredByNameProbesArray = filteredByNameProbesArray.slice(
          //     0,
          //     1000
          //   );
          // }
          var currentProbe = filteredByNameProbesArray[0];
          this.setState(
            {
              probes: filteredByNameProbesArray,
              probesString: filteredByNameProbesArray.join(),
              probesCount: probesCount,
              currentProbe: currentProbe,
            },
            function () {
              document.activeElement.blur();
              this.props.updateSettings(this.state);
            }
          );
        },
        (err) => {
          console.log("settings - handleInputChange() - error");
          // console.log(err.response.data.msg);
          console.log("error response : ", err);
          this.props.updateShowErrorModal();
        }
      );
    }
  }

  render() {
    var self = this;

    var arraySelect = (
      <FormGroup className="array-panel">
        <select
          name="array"
          ref="array"
          placeholder="select"
          className="custom-select"
          onChange={this.handleInputChange}
          value={this.state.array}
          aria-label="Select Array"
        >
          {updateArrayMenu()}
        </select>
      </FormGroup>
    );

    function updateArrayMenu() {
      var ks = Object.keys(AppConst.settings.arrays);
      var sortedKs = [];
      for (var sample in ks) {
        sortedKs.push([sample, ks[sample]]);
      }
      sortedKs.sort(function (a, b) {
        var auc = a[1].toUpperCase();
        var buc = b[1].toUpperCase();
        return auc < buc ? -1 : auc > buc ? 1 : 0;
      });
      return sortedKs.map(function (s) {
        return (
          <option name="array" key={s[1]} value={s[1]}>
            {AppConst.settings.arrays[s[1]]}
          </option>
        );
      });
    }

    var sampleSelect = (
      <FormGroup className="sample-panel">
        <select
          name="sample"
          ref="sample"
          placeholder="select"
          className="custom-select"
          onChange={this.handleInputChange}
          value={this.state.sample}
          aria-label="Select Sample"
        >
          {updateSampleMenu()}
        </select>
      </FormGroup>
    );

    function updateSampleMenu() {
      var os = AppConst.settings.samples;
      var os_counts = {};
      var os_aggregate_pushed = {};
      var os_with_aggregate_samples = [];
      var o = {};
      os.map(function (d) {
        let k = Object.keys(d)[0];
        let v = d[k];
        let elems = k.split("-");
        let sample = elems[0];
        let ds = elems[1];
        if (os_counts[sample] === undefined) {
          os_counts[sample] = 0;
          var nk = sample + "-aggregate";
          var fse = sample.split("_");
          var fse2 = [];
          fse.forEach(function (d) {
            // test if fetal tissue name scheme
            if (
              d.charAt(0) == d.charAt(0).toLowerCase() &&
              d.charAt(1) == d.charAt(1).toUpperCase()
            ) {
              fse2.push(d);
            } else {
              fse2.push(
                d.replace(/\w\S*/g, function (txt) {
                  return txt.charAt(0).toUpperCase() + txt.substr(1);
                })
              );
            }
          });
          var nv = fse2.join(" ");
          //console.log("nk, nv", nk, nv);
          o = {};
          o[nk] = nv;
          //console.log("o", o);
          os_aggregate_pushed[sample] = false;
          //os_with_aggregate_samples.push(o);
        }
        os_counts[sample] += 1;
        if (!os_aggregate_pushed[sample] && os_counts[sample] > 1) {
          os_with_aggregate_samples.push(o);
          os_aggregate_pushed[sample] = true;
        }
      });
      //console.log("os_with_aggregate_samples", os_with_aggregate_samples);

      /*
            return os.map(function(o) {
              let k = Object.keys(o)[0];
              return <option name="sample" key={k} value={k}>{o[k]}</option>;
            });
      */
      var reformat = function (k, v) {
        var o = {};
        o[k] = v + " (" + os_counts[k.split("-")[0]] + " experiments)";
        return o;
      };

      os_with_aggregate_samples = os_with_aggregate_samples.map(function (o) {
        let k = Object.keys(o)[0];
        let v = o[k];
        return reformat(k, v);
      });

      //console.log(os_with_aggregate_samples);

      return os_with_aggregate_samples.map(function (o) {
        let k = Object.keys(o)[0];
        return (
          <option name="sample" key={k} value={k}>
            {o[k]}
          </option>
        );
      });
    }

    var probeInput = (
      <FormGroup
        className="settings-probes-form"
        controlId="formControlsTextField"
      >
        <FormControl
          as="textarea"
          className="settings-textarea settings-probes-textarea"
          name="probes"
          ref="probes"
          // componentClass="textarea"
          placeholder=""
          value={this.state.probesString}
          onChange={this.handleInputChange}
          onKeyPress={this.handleKeyPress}
          aria-label="SNP IDs Text Input Area"
        />
      </FormGroup>
    );

    var snpFilterToggleSettings = (
      <div
        className={
          self.state.viewMode === "Summary" ||
          self.state.viewMode === "Associations"
            ? ""
            : "hidden-container"
        }
      >
        <FormGroup
          className="settings-probes-form"
          controlId="formControlsToggleField"
        >
          <div className="settings-item-title settings-item-padding-title">
            DHS Filter
            <Form.Check
              inline
              className="ml-2"
              type="checkbox"
              title="DHS Filter toggle checkbox"
              checked={this.state.snpFilter}
              name="snpFilter"
              onChange={this.handleInputChange}
              title="DHS Filter"
              aria-label="DHS Filter"
            />
          </div>
        </FormGroup>
      </div>
    );

    var paddingInputOld = (
      <FormGroup
        className="settings-padding-form"
        controlId="formControlsTextField"
      >
        <input
          id="padding"
          name="padding"
          ref="padding"
          className="settings-textfield settings-padding-textfield"
          type="text"
          value={this.state.padding}
          onChange={this.handleInputChange}
          onKeyPress={this.handleKeyPress}
        />
      </FormGroup>
    );

    var paddingInput = (
      <input
        id="settings-panel-padding-slider"
        className="settings-panel-slider"
        type="text"
        name="padding"
        // value=""
        // data-slider-slideStop={this.handleSlideStop}
        data-slider-ticks="[0, 1, 2, 3, 4]"
        data-slider-ticks-labels={
          "[" + AppConst.settings.paddings.toString() + "]"
        }
        data-slider-min="0"
        data-slider-max="4"
        data-slider-step="1"
        data-slider-value={AppConst.settings.paddings.indexOf(
          this.state.padding
        )}
        data-slider-tooltip="hide"
      />
    );

    var smoothingInput = (
      <input
        id="settings-panel-smoothing-slider"
        className="settings-panel-slider"
        type="text"
        name="smoothing"
        // value=""
        // data-slider-slideStop={this.handleSlideStop}
        data-slider-ticks="[0, 1, 2, 3, 4]"
        data-slider-ticks-labels={
          "[" + AppConst.settings.smoothings.toString() + "]"
        }
        data-slider-min="0"
        data-slider-max={Math.max(AppConst.settings.smoothings).toString()}
        data-slider-step="1"
        data-slider-value={AppConst.settings.smoothings.indexOf(
          this.state.smoothing
        )}
        data-slider-tooltip="hide"
      />
    );

    var probesNotice = (
      <p className="panel-label-notice noselect">
        rsIDs may be separated by commas or newline characters (max. 1000)
      </p>
    );

    var paddingNotice = (
      <p className="panel-label-notice noselect">
        Padding (nt) around the SNP genomic location
      </p>
    );

    var smoothingNotice = (
      <p className="panel-label-notice noselect">
        Smoothing window padding (nt)
      </p>
    );

    var makeViewModeButtonGroupFromArray = function (o) {
      return (
        <Button
          variant="outline-primary"
          size="sm"
          name="viewMode"
          key={o}
          value={o}
          className={self.state.viewMode === o ? "active" : ""}
        >
          {o}
        </Button>
      );
    };

    var viewModeNotice = (
      <p className="panel-label-notice noselect">
        View{" "}
        <em>
          <strong>associations</strong>
        </em>{" "}
        of transcription factors (TF) and footprints with an individual SNP, or
        a{" "}
        <em>
          <strong>summary</strong>
        </em>{" "}
        of TF associations over all SNPs, with positional overlap of selected
        SNPs with associated TFs
      </p>
    );

    var makeSignalTypeButtonGroupFromArray = function (o) {
      return (
        <Button
          variant="outline-primary"
          size="sm"
          name="signalType"
          key={o}
          value={o}
          className={self.state.signalType === o ? "active" : ""}
        >
          {o}
        </Button>
      );
    };

    var signalTypeNotice = (
      <p className="panel-label-notice noselect">
        Display signal as bar chart ("density") or as line chart with cubic
        spline
      </p>
    );

    var makeAnnotationButtonGroupFromArray = function (o) {
      return (
        <Button
          variant="outline-primary"
          size="sm"
          name="annotationType"
          key={o}
          value={o}
          className={self.state.annotationType === o ? "active" : ""}
        >
          {o}
        </Button>
      );
    };

    var annotationNotice = (
      <p className="panel-label-notice noselect">
        Display SNP-specific or all transcription factor overlaps ("All" can
        increase query time)
      </p>
    );

    var renderButton = (
      <Button
        variant="primary"
        size="sm"
        name="render"
        key="render"
        value="render"
        // bsSize="xsmall"
        onClick={this.handleInputChange}
        // className="react-bootstrap-button-custom-style"
      >
        Update
      </Button>
    );

    var pingButton = (
      <Button
        variant="primary"
        size="sm"
        name="render"
        key="ping"
        value="render"
        // bsSize="xsmall"
        onClick={this.handlePing}
        // className="react-bootstrap-button-custom-style"
      >
        Ping
      </Button>
    );

    var sampleSettings = (
      <div>
        <p className="settings-item-title">Sample</p>
        <div>{sampleSelect}</div>
      </div>
    );

    var paddingSettings = (
      <div
        className={
          self.state.viewMode !== "Associations" ? "hidden-container" : ""
        }
      >
        <p className="settings-item-title settings-item-padding-title ">
          Padding
        </p>
        <div className="slider-container noselect">{paddingInput}</div>
        {paddingNotice}
      </div>
    );

    var smoothingSettings = (
      <div>
        <p className="settings-item-title settings-item-padding-title ">
          Smoothing
        </p>
        <div className="slider-container noselect" aria-label="slider">
          {smoothingInput}
        </div>
        {smoothingNotice}
      </div>
    );

    var signalRenderingTypeSettings = (
      <div
        className={
          self.state.viewMode !== "Associations" ? "hidden-container" : ""
        }
      >
        <p className="settings-item-title settings-item-padding-title">
          Signal rendering
        </p>
        <ButtonGroup
          // bsSize="xsmall"
          className="btn-group-panel-custom"
          onClick={this.handleInputChange}
        >
          {AppConst.settings.signalTypes.map(
            makeSignalTypeButtonGroupFromArray
          )}
        </ButtonGroup>
        {signalTypeNotice}
      </div>
    );

    var tfOverlapTypeSettings = (
      <div
        className={
          self.state.viewMode !== "Associations" ? "hidden-container" : ""
        }
      >
        <p className="settings-item-title settings-item-padding-title">
          TF overlaps
        </p>
        <ButtonGroup
          // bsSize="xsmall"
          className="btn-group-panel-custom"
          onClick={this.handleInputChange}
        >
          {AppConst.settings.annotationTypes.map(
            makeAnnotationButtonGroupFromArray
          )}
        </ButtonGroup>
        {annotationNotice}
      </div>
    );

    return (
      <div className="settings">
        <div className="settings-container">
          {/* <h2 className="settings-title" style={{ fontSize: '14.4px' }}>
            {this.props.title}
          </h2> */}
          <div className="mt-1">
            <Brand
              brandTitle={"FORGE2-TF"}
              brandSubtitle={"TF-centric SNP array browser"}
            />
          </div>

          <p className="settings-item-title settings-item-padding-title">
            Mode
          </p>
          <ButtonGroup
            // bsSize="xsmall"
            className="btn-group-panel-custom"
            onClick={this.handleInputChange}
          >
            {AppConst.settings.viewModes.map(makeViewModeButtonGroupFromArray)}
          </ButtonGroup>
          {viewModeNotice}

          <p className="settings-item-title">SNPs</p>
          <div>{arraySelect}</div>

          {sampleSettings}

          {paddingSettings}

          {smoothingSettings}

          {signalRenderingTypeSettings}

          {tfOverlapTypeSettings}

          <p className="settings-item-title settings-item-padding-title">
            SNP IDs
          </p>
          <div>{probeInput}</div>
          {probesNotice}

          {snpFilterToggleSettings}

          <p className="spacer"></p>
          {renderButton}

          {/* <p className="spacer"></p>
          {pingButton} */}
        </div>

        <div className="settings-item-padding-title">
          Questions or comments?
          <br />
          Contact us via{" "}
          <a
            className="settings-link"
            href="mailto:NCIFORGE2TFWebAdmin@mail.nih.gov?subject=FORGE2-TF"
            target="_top"
            title="Support"
            style={{ color: "#0062cc" }}
          >
            email
          </a>
          .<p className="spacer"></p>
        </div>
      </div>
    );
  }
}

export default Settings;
