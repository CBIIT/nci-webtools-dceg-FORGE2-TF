import React from 'react';
import ReactTable from 'react-table';
import FaExternalLink from 'react-icons/lib/fa/external-link';
import axios from 'axios';
import {
  Button,
  ButtonGroup,
  ControlLabel,
  FormGroup,
  FormControl,
} from 'react-bootstrap';
import * as AppConst from '../../appConstants';

class TFSummaryTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clientWidth: -1,
      clientHeight: -1,
      clientMargin: { top: 65, right: 45, bottom: 95, left: 55 },
      clientPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      selectedRow: null,
      mouseoverRow: null,
      tableInitialized: false,
      initialTableRow: 0,
    };
    this.updateDimensions = this.updateDimensions.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.exportData = this.exportData.bind(this);
    this.exportGraph = this.exportGraph.bind(this);
    this.imgError = this.imgError.bind(this);
    this.sortedChange = this.sortedChange.bind(this);
    this.convertTFSummaryToRows = this.convertTFSummaryToRows.bind(this);
    this.convertTFSummaryToSummaryObject = this.convertTFSummaryToSummaryObject.bind(
      this
    );
    this.convertTFSummaryToReactTableDataObj = this.convertTFSummaryToReactTableDataObj.bind(
      this
    );
    this.timeStampInMs =
      window.performance &&
      window.performance.now &&
      window.performance.timing &&
      window.performance.timing.navigationStart
        ? window.performance.now() + window.performance.timing.navigationStart
        : Date.now();
  }

  updateDimensions() {
    if (this.refs && this.refs.tfTableContainer) {
      let { clientHeight, clientWidth } = this.refs.tfTableContainer;
      if (
        clientHeight != this.state.clientHeight ||
        clientWidth != this.state.clientWidth
      ) {
        this.setState({
          clientWidth: clientWidth,
          clientHeight: clientHeight,
        });
      }
    }
  }

  handleInputChange(event, customName, mouseoutFlag) {
    //console.log("handleInputChange");
    const target = event.target;
    var value = mouseoutFlag
      ? null
      : target.type === 'checkbox'
      ? target.checked
      : target.value;
    const name = customName ? customName : target.name;
    //console.log("name", name);
    //console.log("value", value);

    if (name == 'exportTable') {
      this.exportData();
      document.activeElement.blur();
    }

    if (name == 'exportGraph') {
      this.exportGraph();
      document.activeElement.blur();
    }
  }

  exportGraph() {
    function convertToPDF(fName, summary) {
      summary['output'] = fName;
      var tf_summary = summary;
      // var tf_summary_graph_query =
      //   'https://forge2-tf.altiusinstitute.org/assets/services/query_tf_summary_graph.py';
      var tf_summary_graph_query = 'api/query-tf-summary-graph';
      axios({
        method: 'post',
        url: tf_summary_graph_query,
        data: { tf_summary },
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/pdf' },
      }).then(
        (res) => {
          console.log('tfSummaryTable - exportGraph() - result');
          console.log('fn', fName);
          console.log('tf_summary', tf_summary);
          var blob = new Blob([new Uint8Array(res.data)], {
            type: 'application/pdf;',
          });
          if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, fName);
          } else {
            var link = document.createElement('a');
            if (link.download !== undefined) {
              var url = window.URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', fName);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }
          }
        },
        (err) => {
          console.log('tfSummaryTable - exportGraph() - error');
          // console.log(err.response.data.msg);
          console.log("error response : ", err);
        }
      );
    }
    var date = new Date();
    var fName = ['FORGE2-TF', date.toISOString(), 'pdf'].join('.');
    var summary = this.convertTFSummaryToSummaryObject();
    convertToPDF(fName, summary);
  }

  exportData() {
    function convertToCSV(fName, rows) {
      var csv = '';
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        for (var j = 0; j < row.length; j++) {
          var val = row[j] === null ? '' : row[j].toString();
          val = val.replace(/\t/gi, ' ');
          if (j > 0) csv += '\t';
          csv += val;
        }
        csv += '\n';
      }
      // for UTF-16
      var cCode,
        bArr = [];
      bArr.push(255, 254);
      for (var i = 0; i < csv.length; ++i) {
        cCode = csv.charCodeAt(i);
        bArr.push(cCode & 0xff);
        bArr.push((cCode / 256) >>> 0);
      }
      var blob = new Blob([new Uint8Array(bArr)], {
        type: 'text/csv;charset=UTF-16LE;',
      });
      if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, fName);
      } else {
        var link = document.createElement('a');
        if (link.download !== undefined) {
          var url = window.URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', fName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      }
    }
    var date = new Date();
    var fName = ['FORGE2-TF', date.toISOString(), 'csv'].join('.');
    var rows = this.convertTFSummaryToRows();
    convertToCSV(fName, rows);
  }

  componentWillMount() {
    var self = this;
    setTimeout(function () {
      self.updateDimensions();
    }, 100);
  }

  componentDidMount() {
    //     window.addEventListener("resize", this.updateDimensions);
  }

  componentWillUnmount() {
    //     window.removeEventListener("resize", this.updateDimensions);
  }

  componentWillUpdate() {
    //    console.log("tfTable - componentWillUpdate()", this.timeStampInMs);
  }

  componentDidUpdate() {
    //console.log("tfTable - componentDidUpdate()", this.timeStampInMs);
    var self = this;
    setTimeout(() => {
      this.updateDimensions();
      var newMaxHeight =
        parseFloat($('#viewer').height()) -
        parseFloat($('#plot-container').height()) -
        20.0 -
        10.0 -
        parseFloat($('#viewer-summary-header').height()) -
        parseFloat($('#tf-table-header').height()) -
        parseFloat($('#tf-table-header').css('margin-bottom')) -
        parseFloat($('#tf-table-footer').height()) -
        parseFloat($('#tf-table-footer').css('margin-top'));
      console.log('newMaxHeight', newMaxHeight);
      $('.tfSummaryTable').css('max-height', newMaxHeight);
    }, 0);
  }

  /*
  shouldComponentUpdate(nextProps, nextState) {
    console.log("tfTable - shouldComponentUpdate()", this.timeStampInMs, nextProps, nextState);
    return true;
  }
*/

  imgError(ev) {
    ev.target.src = 'assets/img/blank.png';
    ev.target.style = 'max-height:20px;text-align:center';
  }

  sortedChange(column, shiftKey) {
    document.activeElement.blur();
  }

  convertTFSummaryToSummaryObject() {
    let summary = {};
    let fdrPct = AppConst.settings.defaults.fdrThreshold * 100;
    let rows = [];
    rows.push(['TF', 'Database', 'pValue', 'qValue']);
    var data = JSON.parse(this.props.data);
    const dbs = AppConst.settings.tf.databases;
    const dbsLength = dbs.length;
    for (let dbIdx = 0; dbIdx < dbsLength; dbIdx++) {
      let db = dbs[dbIdx];
      let tfPvals = data[db];
      if (!data[db]) continue;
      tfPvals.forEach(function (element) {
        let name = element.id;
        let database = AppConst.settings.tf.db_name_formatted[db];
        let pval = Number.parseFloat(element.pval).toPrecision(6);
        let qval = Number.parseFloat(element.qval).toPrecision(6);
        var row = [name, database, pval, qval];
        rows.push(row);
      });
    }
    summary['fdrPct'] = fdrPct;
    summary['rows'] = rows;
    return summary;
  }

  convertTFSummaryToRows() {
    let fdrPct = AppConst.settings.defaults.fdrThreshold * 100;
    let rows = [];
    rows.push(['TF summary']);
    rows.push([]);
    rows.push(['FDR', AppConst.settings.defaults.fdrThreshold]);
    rows.push(['FDR (%)', fdrPct]);
    rows.push(['probes', this.props.probes.join('|')]);
    rows.push([]);
    rows.push(['TF', 'Database', 'p-value', 'q-value']);
    var data = JSON.parse(this.props.data);
    const dbs = AppConst.settings.tf.databases;
    const dbsLength = dbs.length;
    for (let dbIdx = 0; dbIdx < dbsLength; dbIdx++) {
      let db = dbs[dbIdx];
      if (!data[db]) continue;
      let tfPvals = data[db];
      tfPvals.forEach(function (element) {
        let name = element.id;
        let database = AppConst.settings.tf.db_name_formatted[db];
        let pval = Number.parseFloat(element.pval).toPrecision(6);
        let qval = Number.parseFloat(element.qval).toPrecision(6);
        var row = [name, database, pval, qval];
        rows.push(row);
      });
    }
    return rows;
  }

  convertTFSummaryToReactTableDataObj(data) {
    let objs = [];
    var data = JSON.parse(this.props.data);
    //console.log(this.props.data);
    const dbs = AppConst.settings.tf.databases;
    const dbsLength = dbs.length;
    for (let dbIdx = 0; dbIdx < dbsLength; dbIdx++) {
      let db = dbs[dbIdx];
      let tfPvals = data[db];
      console.log(db, tfPvals);
      if (tfPvals) {
        tfPvals.forEach(function (element) {
          let name = element.id;
          let database = AppConst.settings.tf.db_name_formatted[db];
          let pval = Number.parseFloat(element.pval).toPrecision(6);
          let qval = Number.parseFloat(element.qval).toPrecision(6);
          let modifiedPval = pval == 2.22507e-308 ? '<2.23e-308' : pval;
          let modifiedQval = pval == 2.22507e-308 ? '<3.34e-308' : qval;
          let modifiedDb =
            db == 'jaspar' ? db + '/JASPAR.vertebrates.meme.pngs' : db;
          let modifiedName = db == 'jaspar' ? name.replace(/::/, '_') : name;
          var obj = {
            name: name,
            database: database,
            pval: modifiedPval,
            qval: modifiedQval,
            logo: { name: modifiedName, database: modifiedDb },
          };
          objs.push(obj);
        });
      }
    }
    return objs;
  }

  render() {
    const reactTableColumns = [
      {
        Header: 'Name',
        accessor: 'name',
        width: 'auto',
        headerStyle: { fontWeight: 'bold', textAlign: 'left' },
        Cell: (row) => (
          <div style={{ height: '15px', textAlign: 'left', fontSize: '0.9em' }}>
            {row.value}
          </div>
        ),
      },
      {
        Header: 'Database',
        accessor: 'database',
        width: 120,
        headerStyle: { fontWeight: 'bold', textAlign: 'left', width: '120px' },
        Cell: (row) => (
          <div style={{ height: '15px', textAlign: 'left', fontSize: '0.9em' }}>
            {row.value}
          </div>
        ),
      },
      {
        Header: 'p-value',
        accessor: 'pval',
        width: 120,
        headerStyle: { fontWeight: 'bold', textAlign: 'left', width: '180px' },
        Cell: (row) => (
          <div style={{ height: '15px', textAlign: 'left', fontSize: '0.9em' }}>
            {row.value}
          </div>
        ),
      },
      {
        Header: 'q-value',
        accessor: 'qval',
        width: 120,
        headerStyle: { fontWeight: 'bold', textAlign: 'left', width: '180px' },
        Cell: (row) => (
          <div style={{ height: '15px', textAlign: 'left', fontSize: '0.9em' }}>
            {row.value}
          </div>
        ),
      },
      {
        Header: 'Sequence logo',
        accessor: 'logo',
        headerStyle: { fontWeight: 'bold', textAlign: 'left' },
        width: 150,
        height: 100,
        Cell: (row) => (
          <div
            style={{
              height: 'auto',
              width: 'auto',
              maxWidth: '100%',
              textAlign: 'left',
              fontSize: '0.9em',
            }}
          >
            <img
              style={{ width: '100%', height: 'auto', textAlign: 'left' }}
              src={`assets/services/motif-logos/logos/${row.value.database}/${row.value.name}.png`}
              onError={this.imgError}
            />
          </div>
        ),
      },
    ];
    const summary = this.props.data.summary;
    const probeTFSummary = summary;
    let reactTableData = this.convertTFSummaryToReactTableDataObj(
      probeTFSummary
    );

    var self = this;
    var totalNumberOfTests = AppConst.settings.tf.n;
    var totalNumberOfTestsWithOneOrMoreOverlap = reactTableData.length;
    var fdrPct = AppConst.settings.defaults.fdrThreshold * 100;

    var exportTableButton = (
      <Button
        name="exportTable"
        key="exportTable"
        value="exportTable"
        bsSize="xsmall"
        onClick={this.handleInputChange}
        className="react-bootstrap-button-custom-style"
      >
        <FaExternalLink /> Export CSV
      </Button>
    );

    var exportGraphButton = (
      <Button
        name="exportGraph"
        key="exportGraph"
        value="exportGraph"
        bsSize="xsmall"
        onClick={this.handleInputChange}
        className="react-bootstrap-button-custom-style"
      >
        <FaExternalLink /> Export PDF
      </Button>
    );

    return (
      <div>
        <div
          className="tf-table-header"
          ref="tfTableHeader"
          id="tf-table-header"
        >
          <p>
            Hypergeometric <em>p</em>-values are generated from counts of
            overlaps between a transcription factor and all SNPs of interest,
            and counts of overlaps between a transcription factor and all SNPs
            in the selected variant set.
          </p>
          <p>
            Multiple-testing correction of <strong>{totalNumberOfTests}</strong>{' '}
            <em>p</em>-value tests (
            <strong>{totalNumberOfTestsWithOneOrMoreOverlap}</strong> test
            results displayed, where there is one or more overlaps between SNP
            and putative TF binding site) is performed with the
            Benjamini-Yekutieli method (FDR {fdrPct}%) to yield <em>q</em>
            -values.
          </p>
        </div>
        <div
          className="tf-table-container"
          ref="tfTableContainer"
          id={this.props.id}
        >
          <ReactTable
            className="tfSummaryTable -striped -highlight"
            data={reactTableData}
            columns={reactTableColumns}
            defaultPageSize={reactTableData.length}
            showPagination={false}
            defaultSorted={[
              {
                id: 'pval',
                desc: false,
              },
            ]}
            onSortedChange={(c, s) => {
              this.sortedChange(c, s);
            }}
            getTrProps={(state, rowInfo) => {
              if (typeof rowInfo == 'undefined') {
                rowInfo = { index: null };
              }
              if (
                rowInfo &&
                this.state.initialTableRow !== null &&
                rowInfo.viewIndex == this.state.initialTableRow &&
                !this.state.tableInitialized
              ) {
                setTimeout(function () {
                  self.state.tableInitialized = true;
                  self.state.selectedRow = rowInfo.index;
                  self.props.updateSelectedTF(rowInfo);
                }, 0);
              }
              return {
                onClick: (e) => {
                  this.setState(
                    {
                      selectedRow:
                        rowInfo.index == this.state.selectedRow
                          ? null
                          : rowInfo.index,
                    },
                    function () {
                      this.props.updateSelectedTF(
                        this.state.selectedRow !== null ? rowInfo : null
                      );
                    }
                  );
                },
                onMouseOver: (e) => {
                  if (this.state.selectedRow !== null) return;
                  this.setState(
                    {
                      mouseoverRow:
                        rowInfo.index == this.state.mouseoverRow
                          ? null
                          : rowInfo.index,
                    },
                    function () {
                      this.props.updateMouseoverTF(
                        this.state.mouseoverRow !== null ? rowInfo : null
                      );
                    }
                  );
                },
                onMouseOut: (e) => {
                  if (this.state.mouseoverRow === null) return;
                  this.setState(
                    {
                      mouseoverRow: null,
                    },
                    function () {
                      this.props.updateMouseoverTF(null);
                    }
                  );
                },
                style: {
                  background:
                    rowInfo.index === this.state.selectedRow ||
                    rowInfo.index === this.state.mouseoverRow
                      ? AppConst.settings.style.color
                          .sequenceHighlightedBackground
                      : 'white',
                  color:
                    rowInfo.index === this.state.selectedRow ||
                    rowInfo.index === this.state.mouseoverRow
                      ? 'black'
                      : 'black',
                  fontWeight:
                    rowInfo.index === this.state.selectedRow ||
                    rowInfo.index === this.state.mouseoverRow
                      ? 'bold'
                      : 'normal',
                },
              };
            }}
          />
        </div>
        <div
          className="tf-table-footer"
          ref="tfTableFooter"
          id="tf-table-footer"
        >
          {exportTableButton} {exportGraphButton}
        </div>
      </div>
    );
  }
}

export default TFSummaryTable;
