import React from "react";
import Table from "../Table/Table";
import { TableContext } from "../Context/TableContext";

class Main extends React.Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return (
      <TableContext.Consumer>
        {({
          rows,
          cols,
          theme,
          starting,
          ending,
          current,
          changeEndpoint,
          wallConstructorOn,
          wallConstructorOff,
          wallBuilding
        }) => {
          return (
            <div id={"main"} className={"main"}>
              <table>
                <tbody>
                  <Table
                    cols={cols}
                    rows={rows}
                    theme={theme}
                    ending={ending}
                    current={current}
                    draggable={false}
                    starting={starting}
                    wallBuilding={wallBuilding}
                    wallConstructorOn={wallConstructorOn}
                    wallConstructorOff={wallConstructorOff}
                  />
                </tbody>
              </table>
            </div>
          );
        }}
      </TableContext.Consumer>
    );
  }
}

export default Main;
