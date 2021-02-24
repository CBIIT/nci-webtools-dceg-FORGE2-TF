import React from 'react';
import axios from 'axios';
import Spinner from 'react-svg-spinner';

import FaAngleLeft from 'react-icons/lib/fa/angle-left';
import FaAngleRight from 'react-icons/lib/fa/angle-right';

import Plot from './plot';
import TFTable from './tfTable';
import TFSummaryTable from './tfSummaryTable';
import TFPlot from './tfPlot';

import * as AppConst from '../../appConstants';

import { useSelector, useDispatch } from 'react-redux';
import { actions } from '../../services/store';


class Viewer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clientWidth: -1,
      clientHeight: -1,
      clientMargin: 12,
      clientPadding: 12,
      navbarHeight: 0,
      associationData: {},
      associationDataAvailable: false,
      summaryData: {},
      summaryDataAvailable: false,
      tfAggregateData: {},
      tfAggregateDataAvailable: false,
      tfProbeOverlapData: {},
      tfProbeOverlapDataAvailable: false,
      tfQueryProbeMatches: [],
      currentProbe: null,
      selectedTF: null,
      mouseoveredTF: null,
      plotKey: this.props.plotKey,
    };
    this.updateDimensions = this.updateDimensions.bind(this);
    this.updateAssociationData = this.updateAssociationData.bind(this);
    this.updateSummaryData = this.updateSummaryData.bind(this);
    this.updateSelectedTF = this.updateSelectedTF.bind(this);
    this.updateMouseoverTF = this.updateMouseoverTF.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.renderAssociationHeader = this.renderAssociationHeader.bind(this);
    this.renderAssociationBody = this.renderAssociationBody.bind(this);
    this.renderSummaryHeader = this.renderSummaryHeader.bind(this);
    this.renderSummaryBody = this.renderSummaryBody.bind(this);
    this.renderOverlapHeader = this.renderOverlapHeader.bind(this);
    this.renderEmptyBody = this.renderEmptyBody.bind(this);
    this.renderContent = this.renderContent.bind(this);
  }

  updateDimensions() {
    if (this.refs && this.refs.viewerContainer) {
      let { clientHeight, clientWidth } = this.refs.viewerContainer;
      this.setState({
        clientWidth: parseFloat(
          clientWidth -
            2 * this.state.clientMargin -
            2 * this.state.clientPadding
        ),
        clientHeight: parseFloat(
          clientHeight -
            2 * this.state.clientMargin -
            2 * this.state.clientPadding -
            this.state.navbarHeight
        ),
      });
    }
  }

  componentWillMount() {
    var self = this;
    setTimeout(function () {
      self.updateDimensions();
    }, 100);
  }

  componentDidMount() {
    window.addEventListener('resize', this.updateDimensions);
    if (this.props.settings.viewMode == 'Associations') {
      this.updateAssociationData();
    } else if (this.props.settings.viewMode == 'Summary') {
      this.updateSummaryData();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions);
  }

  componentDidUpdate() {
    if (this.props.settingsChangeStart) {
      var self = this;
      this.props.updateSettingsChange(false, function () {
        self.setState(
          {
            associationData: {},
            associationDataAvailable: false,
            summaryData: {},
            summaryDataAvailable: false,
          },
          function () {
            console.log(
              'viewer - componentDidUpdate() - issuing POST request...',
              self.props.settings.viewMode
            );
            if (self.props.settings.viewMode == 'Associations') {
              self.updateAssociationData();
            } else if (this.props.settings.viewMode == 'Summary') {
              this.updateSummaryData();
            }
          }
        );
      });
    }
  }

  updateAssociationData() {
    var settings = this.props.settings;
    console.log('viewer - updateAssociationData() - settings');
    console.log(settings);
    // var single_sample_query =
    //   'https://forge2-tf.altiusinstitute.org/assets/services/query.py';
    // var aggregate_sample_query =
    //   'https://forge2-tf.altiusinstitute.org/assets/services/query_aggregate.py';
    var single_sample_query = 'api/query';
    var aggregate_sample_query = 'api/query-aggregate';
    var sample_label = settings.sample;
    var se = sample_label.split('-');
    var sample = se[0];
    var ds = se[1];
    var sample_query =
      ds == 'aggregate' ? aggregate_sample_query : single_sample_query;
    var self = this;
    axios.post(sample_query, { settings }).then(
      (res) => {
        console.log('viewer - updateAssociationData() - result');
        console.log(res.data);
        self.setState({
          associationData: res.data,
          associationDataAvailable: true,
          currentProbe: res.data.probe.name,
          selectedTF: null,
          mouseoveredTF: null,
        });
      },
      (err) => {
        console.log("viewer - updateAssociationData() - error");
        console.log("error response : ", err.response);
        // const dispatch = useDispatch();
        // actions.updateKey({ 
        //   key: 'errorModal', 
        //   data: { 
        //     visible: true 
        //   }
        // });
        self.setState({
          associationData: {},
          associationDataAvailable: false,
          currentProbe: settings.currentProbe,
          selectedTF: null,
          mouseoveredTF: null,
        });
      }
    );
  }

  updateSummaryData() {
    var settings = this.props.settings;
    var tf_summary = {};
    tf_summary['array'] = settings.array;
    tf_summary['probes'] = settings.probes;
    tf_summary['fdrThreshold'] = AppConst.settings.defaults.fdrThreshold;
    tf_summary['nTests'] = AppConst.settings.tf.n;
    console.log('viewer - updateSummaryData() - tf_summary');
    console.log(tf_summary);
    // var tf_summary_query =
    //   'https://forge2-tf.altiusinstitute.org/assets/services/query_tf_summary.py';
    var tf_summary_query = 'api/query-tf-summary';
    var self = this;
    axios.post(tf_summary_query, { tf_summary }).then(
      (res) => {
        console.log('viewer - updateSummaryData() - result');
        console.log(res.data);
        self.setState({
          summaryData: res.data,
          summaryDataAvailable: true,
          selectedTF: null,
          mouseoveredTF: null,
        });
      },
      (err) => {
        // console.log(err.response.data.msg);
        console.log('NO DATA');
        self.setState({
          summaryData: {},
          summaryDataAvailable: false,
          selectedTF: null,
          mouseoveredTF: null,
        });
      }
    );
  }

  updateSelectedTF(rowInfo) {
    console.log('viewer - updateSelectedTF() - rowInfo', rowInfo);
    this.setState(
      {
        selectedTF: rowInfo,
      },
      function () {
        if (!this.state.selectedTF) return;
        var settings = this.props.settings;
        var tfModel = this.state.selectedTF.row.name;
        var sample = this.props.settings.sample;
        var padding = settings.padding;
        var smoothing = settings.smoothing;
        // to retrieve signal, we need to submit a POST request for specified samples and selected TF
        var tf_aggregate_summary = {};
        tf_aggregate_summary['array'] = settings.array;
        tf_aggregate_summary['tfModel'] = tfModel;
        tf_aggregate_summary['sample'] = sample;
        tf_aggregate_summary['padding'] = 20;
        tf_aggregate_summary['smoothing'] = smoothing;
        tf_aggregate_summary['signalType'] = settings.signalType;
        console.log('viewer - updateSelectedTF() - tf_aggregate_summary');
        console.log(tf_aggregate_summary);
        // var tf_aggregate_summary_query =
        //   'https://forge2-tf.altiusinstitute.org/assets/services/query_tf_aggregate_summary.py';
        var tf_aggregate_summary_query = 'api/query-tf-aggregate-summary';
        var self = this;
        axios.post(tf_aggregate_summary_query, { tf_aggregate_summary }).then(
          (agg_result) => {
            console.log('viewer - updateSelectedTF() - agg_result');
            console.log(agg_result.data);
            // var tf_probe_overlap_query =
            //   'https://forge2-tf.altiusinstitute.org/assets/services/query_tf_probe_overlap_summary.py';
            var tf_probe_overlap_query = 'api/query-tf-probe-overlap-summary';
            var tf_probe_overlap_summary = {};
            tf_probe_overlap_summary['array'] = settings.array;
            tf_probe_overlap_summary['tfModel'] = tfModel;
            tf_probe_overlap_summary['padding'] = 20;
            axios.post(tf_probe_overlap_query, { tf_probe_overlap_summary })
              .then(
                (overlap_result) => {
                  console.log('viewer - updateSelectedTF() - overlap_result');
                  console.log(overlap_result.data);
                  overlap_result.data['overlaps']['probes'] =
                    overlap_result.data['overlaps']['probes']['probes'];
                  var tf_query_probe_matches = [];
                  self.props.settings.probes.forEach(function (targetProbe) {
                    overlap_result.data['overlaps']['probes'].forEach(function (
                      queryProbes,
                      queryPositionIndex
                    ) {
                      if (!queryProbes) return;
                      queryProbes.forEach(function (queryProbe) {
                        if (targetProbe === queryProbe) {
                          console.log(
                            'match of',
                            targetProbe,
                            'at position',
                            queryPositionIndex
                          );
                          tf_query_probe_matches.push({
                            probe: targetProbe,
                            position: queryPositionIndex,
                          });
                        }
                      });
                    });
                  });

                  self.setState(
                    {
                      tfAggregateData: agg_result.data,
                      tfAggregateDataAvailable: true,
                      tfProbeOverlapData: overlap_result.data,
                      tfProbeOverlapDataAvailable: true,
                      tfQueryProbeMatches: tf_query_probe_matches,
                    },
                    function () {
                      console.log('state', self.state);
                    }
                  );
                },
                (overlap_err) => {
                  console.log('overlap_err', overlap_err.response);
                }
              );
          },
          (agg_err) => {
            console.log('agg_err', agg_err.response);
            self.setState({
              tfAggregateData: {},
            });
          }
        );
      }
    );
  }

  updateMouseoverTF(rowInfo) {
    //    console.log("viewer - updateMouseoverTF() - rowInfo", rowInfo);
    this.setState({
      mouseoveredTF: rowInfo,
    });
  }

  handleInputChange(event, customName, mouseoutFlag) {
    //console.log("handleInputChange");
    const target = event.target;
    var value = target.type === 'checkbox' ? target.checked : target.value;
    const name = customName ? customName : target.name;

    if (name == 'viewer-go-previous') {
      this.props.updateCurrentProbe('previous');
    } else if (name == 'viewer-go-next') {
      this.props.updateCurrentProbe('next');
    }

    document.activeElement.blur();
  }

  renderAssociationHeader() {
    if (this.props.settings && this.props.settings.probesCount >= 1) {
      return (
        <div className="viewer-gallery-header" id="viewer-gallery-header">
          <div>
            <button
              type="button"
              disabled={this.props.settings.probesCount == 1}
              value="viewer-go-previous"
              className="react-bootstrap-button-custom-style btn btn-default"
              name="viewer-go-previous"
              onClick={this.handleInputChange}
            >
              <FaAngleLeft />
            </button>
          </div>
          <div className="viewer-gallery-header-title">
            SNP TF and Footprint Associations
          </div>
          <div>
            <button
              type="button"
              disabled={this.props.settings.probesCount == 1}
              value="viewer-go-next"
              className="react-bootstrap-button-custom-style btn btn-default"
              name="viewer-go-next"
              onClick={this.handleInputChange}
            >
              <FaAngleRight />
            </button>
          </div>
        </div>
      );
    }
    return <div className="viewer-gallery-header" id="viewer-gallery-header" />;
  }

  renderAssociationBody() {
    return (
      <div>
        <div className="viewer-plot">
          <Plot
            id="plot-container"
            data={this.state.associationData}
            selectedTF={this.state.selectedTF}
            mouseoveredTF={this.state.mouseoveredTF}
            key={this.props.plotKey}
          />
        </div>
        <div className="viewer-tf-table-container">
          <div className="viewer-paragraph" id="viewer-hint">
            <em>Hint</em>: Move your mouse pointer over a row to highlight a
            transcription factor binding site. Click once to lock the highlight,
            and click again to unlock.
          </div>
          <div className="viewer-tf-table-container">
            <TFTable
              id="tf-table"
              data={this.state.associationData}
              updateSelectedTF={this.updateSelectedTF}
              updateMouseoverTF={this.updateMouseoverTF}
              key={this.props.tfTableKey}
            />
          </div>
        </div>
      </div>
    );
  }

  renderSummaryHeader() {
    return (
      <div className="viewer-summary-header" id="viewer-summary-header">
        <div className="viewer-summary-header-title">TF Summary</div>
      </div>
    );
  }

  renderSummaryBody() {
    return (
      <div>
        <div className="viewer-plot">
          <TFPlot
            id="plot-container"
            data={this.state.tfAggregateData}
            selectedTF={this.state.selectedTF}
            mouseoveredTF={this.state.mouseoveredTF}
            queryProbeMatches={this.state.tfQueryProbeMatches}
            key={this.props.plotKey}
          />
        </div>
        <div className="viewer-tf-table-container">
          <div className="viewer-tf-table-container">
            <TFSummaryTable
              id="tf-summary-table"
              data={this.state.summaryData}
              probes={this.props.settings.probes}
              updateSelectedTF={this.updateSelectedTF}
              updateMouseoverTF={this.updateMouseoverTF}
              key={this.props.tfSummaryTableKey}
            />
          </div>
        </div>
      </div>
    );
  }

  renderOverlapHeader() {
    return (
      <div className="viewer-overlap-header" id="viewer-overlap-header">
        <div className="viewer-overlap-header-title">TF Overlaps</div>
      </div>
    );
  }

  renderEmptyBody() {
    return (
      <div className="spinner-wrapper">
        <div className="spinner-main">
          <Spinner size="64px" thickness={1} />
        </div>
      </div>
    );
  }

  renderContent() {
    if (this.props.settings.viewMode == 'Associations') {
      return (
        <div>
          {this.renderAssociationHeader()}
          {(this.state.associationDataAvailable &&
            this.renderAssociationBody()) ||
            this.renderEmptyBody()}
        </div>
      );
    } else if (this.props.settings.viewMode == 'Summary') {
      return (
        <div>
          {this.renderSummaryHeader()}
          {(this.state.summaryDataAvailable && this.renderSummaryBody()) ||
            this.renderEmptyBody()}
        </div>
      );
    } else {
      return <div>{this.renderEmptyBody()}</div>;
    }
  }

  render() {
    return (
      <div
        className="viewer-container"
        ref="viewerContainer"
        id={this.props.id}
      >
        {this.renderContent()}
      </div>
    );
  }
}

export default Viewer;
