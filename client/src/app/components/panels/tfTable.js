import React from 'react';
import ReactTable from 'react-table';
import * as AppConst from '../../appConstants';

class TFTable extends React.Component {
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
      initialTableRow: null,
    };
    this.updateDimensions = this.updateDimensions.bind(this);
    this.imgError = this.imgError.bind(this);
    this.sortedChange = this.sortedChange.bind(this);
    this.convertTFOverlapsToReactTableDataObj = this.convertTFOverlapsToReactTableDataObj.bind(
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
    //    console.log("tfTable - componentDidUpdate()", this.timeStampInMs);
    setTimeout(function () {
      //self.updateDimensions();
      $('.tfTable').css(
        'max-height',
        parseFloat($('#viewer').height()) -
          parseFloat($('#plot-container').height()) -
          parseFloat($('#viewer-hint').height()) -
          parseFloat($('#viewer-gallery-header').height()) -
          2 * 20.0
      );
    }, 100);
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

  convertTFOverlapsToReactTableDataObj(data) {
    let objs = [];
    const probe = this.props.data.probe;
    const dbs = AppConst.settings.tf.databases;
    const dbsLength = dbs.length;
    for (let dbIdx = 0; dbIdx < dbsLength; dbIdx++) {
      let db = dbs[dbIdx];
      let tfOverlaps = probe.tf_overlaps[db];
      tfOverlaps.forEach(function (element) {
        let name = element.id;
        let database = AppConst.settings.tf.db_name_formatted[db];
        let score = element.score;
        let position =
          element.chromosome +
          ':' +
          element.start +
          '-' +
          element.stop +
          ':' +
          element.strand;
        //let sequence = element.sequence;
        let modifiedDb =
          db == 'jaspar' ? db + '/JASPAR.vertebrates.meme.pngs' : db;
        let modifiedName = db == 'jaspar' ? name.replace(/::/, '_') : name;
        var obj = {
          name: name,
          database: database,
          score: score,
          position: position,
          //'sequence' : sequence,
          logo: { name: modifiedName, database: modifiedDb },
        };
        objs.push(obj);
      });
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
        Header: 'FIMO p-value',
        accessor: 'score',
        width: 180,
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
              height: '70px',
              width: 'auto',
              maxWidth: '100%',
              textAlign: 'left',
              fontSize: '0.9em',
            }}
          >
            <img
              style={{ width: '100%', height: 'auto', textAlign: 'left' }}
              src={`assets/motif-logos/logos/${row.value.database}/${row.value.name}.png`}
              onError={this.imgError}
            />
          </div>
        ),
      },
      {
        Header: 'Position',
        accessor: 'position',
        width: 'auto',
        headerStyle: { fontWeight: 'bold', textAlign: 'left' },
        Cell: (row) => (
          <div style={{ height: '15px', textAlign: 'left', fontSize: '0.9em' }}>
            {row.value}
          </div>
        ),
      },
    ];
    const probe = this.props.data.probe;
    const probeTFOverlaps = probe.tf_overlaps;
    let reactTableData = this.convertTFOverlapsToReactTableDataObj(
      probeTFOverlaps
    );

    var self = this;

    return (
      <div
        tabIndex="0"
        className="tf-table-container"
        ref="tfTableContainer"
        id={this.props.id}
      >
        <ReactTable
          className="tfTable -striped -highlight"
          data={reactTableData}
          columns={reactTableColumns}
          defaultPageSize={reactTableData.length}
          showPagination={false}
          defaultSorted={[
            {
              id: 'score',
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
    );
  }
}

export default TFTable;
