import React from "react";
import Td from "./Td";

class Tr extends React.Component {
  //   shouldComponentUpdate(nextProp, nextState) {
  //     // debugger;
  //     return false;
  //   }

  render() {
    const {
      r,
      cols,
      current,
      starting,
      ending,
      wallConstructorOn,
      wallConstructorOff,
      wallBuilding
    } = this.props;
    const tds = [];
    for (let i = 0; i < cols; i++) {
      tds.push(
        <Td
          r={r}
          c={i}
          key={`${r}-${i}`}
          current={current}
          starting={starting}
          ending={ending}
          draggable={false}
          wallConstructorOn={wallConstructorOn}
          wallConstructorOff={wallConstructorOff}
          wallBuilding={wallBuilding}
        />
      );
    }

    return <tr>{tds}</tr>;
  }
}
export default Tr;
