import React from "react";
import Td from "./Td";

class Tr extends React.Component {

  render() {
    const {
      r,
      cols,
      current,
      starting,
      ending,
      wallConstructorOn,
      wallConstructorOff,
      wallBuilding,
      theme
    } = this.props;
    const tds = [];
    for (let i = 0; i < cols; i++) {
      tds.push(
        <Td
          r={r}
          c={i}
          theme={theme}
          ending={ending}
          key={`${r}-${i}`}
          draggable={false}
          current={current}
          starting={starting}
          wallBuilding={wallBuilding}
          wallConstructorOn={wallConstructorOn}
          wallConstructorOff={wallConstructorOff}
        />
      );
    }

    return <tr>{tds}</tr>;
  }
}
export default Tr;
