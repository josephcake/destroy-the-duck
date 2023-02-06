import React from "react";
class Td extends React.Component {

  render() {
    const {
      r,
      c,
      starting,
      ending,
      current,
      wallConstructorOn,
      wallBuilding
    } = this.props;

    const cell = `${r}-${c}`;
    let classN =
      cell === ending
        ? "ending"
        : cell === starting
        ? "starting"
        : cell === current
        ? "visited"
        : "unvisited";
    return (
      <td
        className={classN}
        id={cell}
        draggable={false}
        onMouseDown={wallConstructorOn}
        onMouseMove={wallBuilding}
      />
    );
  }
}
export default Td;
