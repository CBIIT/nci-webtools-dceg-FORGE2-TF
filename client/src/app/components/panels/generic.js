import React from 'react';

class GenericPanel extends React.Component {
  
  constructor(props) {
    super(props);
  }
  
  render() {
    return (
      <div className="panel panel-default">
        <div className="panel-heading">
          <h3 className="panel-title">{this.props.title}</h3>
        </div>
        <div className="panel-body">
          {this.props.children}
        </div>
      </div>
    )
  }
}

export default GenericPanel;