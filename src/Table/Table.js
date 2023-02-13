import React from "react";
import Tr from "./Tr";

class Table extends React.Component {
  shouldComponentUpdate(nextProp, nextState) {
    if (
      this.props.ending !== nextProp.ending ||
      this.props.theme !== nextProp.theme
    ) {
      return true;
    }
    return false;
  }
  render() {
    const rowsData = [];
    const {
      rows,
      cols,
      current,
      starting,
      ending,
      wallBuilding,
      wallConstructorOn,
      wallConstructorOff,
      theme,
    } = this.props;

    for (let i = 0; i < rows; i++) {
      rowsData.push(
        <Tr
          r={i}
          key={i}
          cols={cols}
          theme={theme}
          ending={ending}
          draggable={false}
          current={current}
          starting={starting}
          wallBuilding={wallBuilding}
          wallConstructorOn={wallConstructorOn}
          wallConstructorOff={wallConstructorOff}
        />
      );
    }

    return rowsData;
  }
}
export default Table;
