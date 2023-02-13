import React from "react";
class Td extends React.Component {
  // shouldComponentUpdate(nextProps, nextState) {
  //   const nextCellID = `${nextProps.r}-${nextProps.c}`;
  //   const nextCell = document.getElementById(nextCellID)
  //   console.log({nextCellID}, nextCell.className)
  //   if(nextCell.className.includes('_visited')){
  //     return false
  //   }
  //   return true
  // }
  render() {
    const {
      r,
      c,
      starting,
      ending,
      current,
      wallConstructorOn,
      wallBuilding,
      theme,
    } = this.props;
    const cell = `${r}-${c}`;
    let classN =
    cell === ending
    ? `${theme}_ending`
    : cell === starting
    ? `${theme}_starting`
    : cell === current
    ? `${theme}_visited`
    : `${theme}_unvisited`;

    return (
      <td
        className={`${classN}`}
        id={cell}
        draggable={false}
        onMouseDown={wallConstructorOn}
        onMouseMove={wallBuilding}
      />
    );
  }
}
export default Td;
