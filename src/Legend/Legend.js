import React from "react";

export const Legend = () => {
  return (
    <div className={"legend"}>
      <div className={"legend__section"}>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Arrow :</label>
          <img
            className={"legend__item-icon bullet"}
            src={require("../Images/feathered-arrow.png")}
            alt={"Bullet"}
          />
        </div>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Duck :</label>
          <img
            className={"legend__item-icon duck"}
            src={require("../Images/duck.png")}
            alt={"Duck"}
          />
        </div>
      </div>
      <div className={"legend__section"}>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Path :</label>
          <div className={"legend__item-icon visited-legend"}></div>
        </div>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Wall :</label>
          <div className={"legend__item-icon wall-legend"}></div>
        </div>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Unvisited :</label>
          <div className={"legend__item-icon unvisited-legend"}></div>
        </div>
      </div>
      <div className={"legend__section"}>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Goal :</label>
        </div>
        <div className={"legend__item"}>
          <label className={"legend__item-label"}>Destroy the Duck!!</label>
        </div>
      </div>
    </div>
  );
};
// export default Legend;
