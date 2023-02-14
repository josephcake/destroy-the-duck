import React, { Component, createContext } from "react";
import { BASIC_WALL } from "../Wall/BasicWall";
import { SPIRAL_WALL } from "../Wall/SpiralWall";
import { STAIR_WALL } from "../Wall/StairWall";
import { TARGET_WALL } from "../Wall/TargetWall";
import { CHECKER_WALL } from "../Wall/CheckerWall";
import { FOREST_WALL } from "../Wall/ForestWall";

export const TableContext = createContext();
export class TableContextProvider extends Component {
  state = {
    starting: "17-15",
    ending: "17-64",
    rows: 35,
    cols: 80,
    algorithm: "algorithm",
    current: "17-15",
    running: false,
    refresh: false,
    block: "",
    speed: 20,
    speedText:'norm',
    theme:'light',
    maze:"maze"
  };
  componentDidMount() {
    window.addEventListener("mouseup", this.wallConstructorOff);
  // const node = document.getElementById(this.state.ending); //some animations takes a while to execute
  //   const mutation = nodeList => {
  //     if (nodeList[0].target.className === "ending-acquired") {
  //       const theme = this.state.theme
  //       node.className = `${theme}_ending`;
  //       let newState = this.state
  //       newState.running = false
  //       this.setState(newState);
  //     }
  //   };
  //   const observer = new MutationObserver(mutation);
  //   observer.observe(node, {
  //     attributes: true,
  //     attributeFilter: ["class"]
  //   });
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (
      nextState.algorithm !== this.state.algorithm ||
      nextState.ending !== this.state.ending ||
      nextState.wallOn !== this.state.wallOn||
      nextState.theme !== this.state.theme ||
      nextState.speed !== this.state.speed ||
      nextState.speedText !== this.state.speedText ||
      nextState.maze !== this.state.maze ||
      nextState.running !== this.state.running

    ) {
      return true;
    }
    return false;
  }
  setRunning = (running) =>{
    this.setState({
      ...this.state,
      running
    });

    return;
  }

  wallConstructorOn = () => {
    let newState = {...this.state}
    newState.building = true
    this.setState(newState);
  };
  wallConstructorOff = () => {
    let newState = {...this.state}
    newState.building = false
    this.setState(newState);
  };

  wallBuilding = e => {
    if (this.state.building && !this.state.running) {
      let id = e.target.id;
      if (
        String(id) === this.state.starting ||
        String(id) === this.state.ending
      ) {
      } else {
        const theme = this.state.theme
        let cell = document.getElementById(id);
        // if (cell.id !== "17-79") {
        //   if (cell.className === `${theme}_unvisited`) {
        //     cell.className = `${theme}_wall`;
        //   }
        // }
        if (this.state.block !== id) {
          if (cell.id !== "17-79") {
            if (cell.className === `${theme}_unvisited`) {
              cell.className = `${theme}_wall`;
            } else if (cell.className === `${theme}_wall`) {
              cell.className = `${theme}_unvisited`;
            }
          }
          let newState = {...this.state}
          newState.block = id
          this.setState(newState);
        }
      }
    }
  };
  setTheme = () => {
    this.setState({
      ...this.state,
      theme : this.state.theme === 'dark' ? 'light' : 'dark'
    });
    return;
  }
  cannotFindDuck = () => {
    if(window.checkWallInterval){
      clearInterval(window.checkWallInterval)
    }
    let newState = {...this.state}
    newState.running = false
    this.setState(newState);
    return alert('cannot find duck')
  };
  setSpeed = (e) => {
    let name = e.currentTarget.attributes.name.value
    let newState = {...this.state}
    if(name === 'light'){
      newState.speed = 0
      newState.speedText = 'light'
    }else if(name === 'fast'){
      newState.speed = 10
      newState.speedText = 'fast'
    }else if (name === 'norm'){
      newState.speed = 30
      newState.speedText = 'norm'
    }else if (name === 'slow'){
      newState.speed = 150
      newState.speedText = 'slow'
    }else if (name === 'sloth'){
      newState.speed = 1500
      newState.speedText = 'sloth'
    }
    this.setState(newState);
    return;
  }

  buildMaze = name => {
    this.returnToUnvisited();
    this.setState(prevState => {
      return {
        ...prevState,
        maze : name,
        // running : name === "maze" ? false : true
      }
    });
    if(name === "maze") return

    const mazeType = [
      "basic",
      "spiral",
      "stair",
      "target",
      "checker",
      "forest"
    ];
    if (name === "random") {
      this.randomlyGeneratedMaze();
    } else if (name === "vertical") {
      this.directionalGeneratedMaze(
        this.state.cols,
        this.state.rows,
        "vertical",
        true
      );
    } else if (name === "horizontal") {
      this.directionalGeneratedMaze(
        this.state.rows,
        this.state.cols,
        "horizontal",
        true
      );
    } else if (name === "verticalNarrow") {
      this.directionalGeneratedMaze(
        this.state.cols,
        this.state.rows,
        "vertical"
      );
    } else if (name === "horizontalNarrow") {
      this.directionalGeneratedMaze(
        this.state.rows,
        this.state.cols,
        "horizontal"
      );
    } else {
      const mazes = [
        BASIC_WALL,
        SPIRAL_WALL,
        STAIR_WALL,
        TARGET_WALL,
        CHECKER_WALL,
        FOREST_WALL
      ];
      const idx = mazeType.indexOf(name);
      const theme = this.state.theme

      for (let i = 0; i < mazes[idx].length; i++) {
        let k = i;
        let cell = document.getElementById(mazes[idx][k]);
        setTimeout(function() {
          cell.className = `${theme}_wall`;
        }, this.state.speed * k);
      }
    }

  };

  directionalGeneratedMaze = (outerNum, innerNum, direction, wide) => {
    this.returnToUnvisited();
    let wallsToBeBuild = [];
    let spaces = wide ? 6 : 2;
    for (let i = 1; i < outerNum; i += spaces) {
      const skip = Math.floor(Math.random() * innerNum);
      for (let j = 0; j < innerNum; j++) {
        let current = direction === "horizontal" ? `${i}-${j}` : `${j}-${i}`;
        if (current !== this.state.starting && current !== this.state.ending) {
          if (j !== skip) {
            wallsToBeBuild.push(current);
          }
        }
      }
    }
    if (wide && direction === "horizontal") {
      this.horizontalExtension(wallsToBeBuild);
    } else if (wide && direction === "vertical") {
      this.verticalExtension(wallsToBeBuild);
    } else {
      const theme = this.state.theme

      for (let i = 0; i < wallsToBeBuild.length; i++) {
        let k = i;
        setTimeout(() => {
          let cell = document.getElementById(wallsToBeBuild[k]);
          cell.className = `${theme}_wall`;
        }, this.state.speed * k);
      }
    }
    let newState = {...this.state}
    newState.running = true
    this.setState(newState);
  };
  horizontalExtension = wallsToBeBuild => {
    const theme = this.state.theme
    for (let i = 0; i < wallsToBeBuild.length; i++) {
      let k = i;
      let extra = Math.ceil(Math.random() * 2);
      let upOrDown = Math.floor(Math.random() * 10) > 5 ? true : false;
      setTimeout(() => {
        let current = wallsToBeBuild[k].split("-");
        let cR = Number(current[0]);
        let cC = Number(current[1]);
        let cell = document.getElementById(wallsToBeBuild[k]);
        for (let i = 0; i < extra; i++) {
          if (upOrDown) {
            let tempCell = document.getElementById(`${cR - 1}-${cC}`);
            if (
              tempCell &&
              tempCell.className !== `${theme}_starting` &&
              tempCell.className !== `${theme}_ending`
            ) {
              tempCell.className = `${theme}_wall`;
              cR--;
            }
          } else {
            let tempCell = document.getElementById(`${cR + 1}-${cC}`);
            if (
              tempCell &&
              tempCell.className !== `${theme}_starting` &&
              tempCell.className !== `${theme}_ending`
            ) {
              tempCell.className = `${theme}_wall`;
              cR++;
            }
          }
        }

        cell.className = `${theme}_wall`;
      }, this.state.speed * k);
    }
  };
  verticalExtension = wallsToBeBuild => {
    const theme = this.state.theme

    for (let i = 0; i < wallsToBeBuild.length; i++) {
      let k = i;
      let extra = Math.ceil(Math.random() * 2);
      let leftOrRight = Math.floor(Math.random() * 10) > 5 ? true : false;
      setTimeout(() => {
        let current = wallsToBeBuild[k].split("-");
        let cR = Number(current[0]);
        let cC = Number(current[1]);
        let cell = document.getElementById(wallsToBeBuild[k]);
        for (let i = 0; i < extra; i++) {
          if (leftOrRight) {
            let tempCell = document.getElementById(`${cR}-${cC - 1}`);
            if (
              tempCell &&
              tempCell.className !== `${theme}_starting` &&
              tempCell.className !== `${theme}_ending`
            ) {
              tempCell.className = `${theme}_wall`;
              cC--;
            }
          } else {
            let tempCell = document.getElementById(`${cR}-${cC + 1}`);
            if (
              tempCell &&
              tempCell.className !== `${theme}_starting` &&
              tempCell.className !== `${theme}_ending`
            ) {
              tempCell.className = `${theme}_wall`;
              cC++;
            }
          }
        }

        cell.className = `${theme}_wall`;
      }, this.state.speed * k);
    }
  };

  randomlyGeneratedMaze = () => {
    this.returnToUnvisited();
    const theme = this.state.theme
    let wallsToBeBuild = [];

    const unvisited = document.getElementsByClassName(`${theme}_unvisited`);
    const unvisitedArr = Array.from(unvisited);
    for (let i = 0; i < unvisitedArr.length; i++) {
      const skip = Math.floor(Math.random() * 9);
      const walls = Math.floor(Math.random() * 4);
      if (i + walls < unvisitedArr.length) {
        for (let j = 0; j < walls; j++) {
          let cell = unvisitedArr[i + j];
          wallsToBeBuild.push(cell.id);
        }
      }
      i += skip;
    }

    for (let i = 0; i < wallsToBeBuild.length; i++) {
      let k = i;
      setTimeout(() => {
        let cell = document.getElementById(wallsToBeBuild[k]);
        cell.className = `${theme}_wall`;
      }, this.state.speed * k);
    }
    let newState = {...this.state}
    newState.running = true
    this.setState(newState);

  };

  clearBoard = e => {
    this.returnToUnvisited(e);
    let newState = {...this.state}
    newState.running = false
    newState.current = this.state.starting
    this.setState(newState);
  };

  returnToUnvisited = e => {
    const theme = this.state.theme
    if (e) {
      let name = e.target ? e.target.name : e;
      const cellsHTML = document.getElementsByClassName(`${theme}_${name}`);
      const cellsArr = Array.from(cellsHTML);
      for (let i = 0; i < cellsArr.length; i++) {
        let k = i;
        cellsArr[k].className = `${theme}_unvisited`;
      }
    } else {
      const unvisitedAnimated = document.getElementsByClassName(`${theme}_visited`);
      const cellsHTML = document.getElementsByClassName(`${theme}_wall`);
      const cellsArr = Array.from(cellsHTML);
      const arrVisited = Array.from(unvisitedAnimated);

      for (let i = 0; i < cellsArr.length; i++) {
        let k = i;
        cellsArr[k].className = `${theme}_unvisited`;
      }
      for (let i = 0; i < arrVisited.length; i++) {
        let k = i;
        arrVisited[k].className = `${theme}_unvisited`;
      }
    }
  };

  selectAlgorithm = e => {
    let algorithm = e.target.value;
    let newState = {...this.state}
    newState.algorithm = algorithm
    this.setState(newState);
  };

  go = () => {
    this.returnToUnvisited(`visited`);
    const name = this.state.algorithm;
    if (name === "algorithm") {
      let newState = {...this.state}
      newState.running = false
      this.setState(newState);
      return;
    }
    const algorithmNames = [
      "knownEndPointSearch",
      "linearSearch",
      "breadthFirstSearch",
      "depthFirstSearch",
      "bidirectionalSearch",
      "randomSearch"
    ];
    const algorithms = [
      this.knownEndPointSearch,
      this.linearSearch,
      this.breadthFirstSearch,
      this.depthFirstSearch,
      this.bidirectionalSearch,
      this.randomSearch
    ];
    const selected = algorithmNames.indexOf(name);
    algorithms[selected]();
  };

  bidirectionalSearch = () => {
    let startingQueue = [this.state.current];
    let endingQueue = [this.state.ending];
    let startingPath = {};
    let endingPath = {};
    let counter = 0;
    const theme = this.state.theme
    while (
      !startingPath[endingQueue[counter]] &&
      !endingPath[startingQueue[counter]]
    ) {
      if (
        startingQueue[counter] === "crossed" ||
        endingQueue[counter] === "crossed"
      ) {
        break;
      }
      try {
        let current = startingQueue[counter].split("-");
        let current2 = endingQueue[counter].split("-");
        let cR = Number(current[0]);
        let cC = Number(current[1]);
        let cR2 = Number(current2[0]);
        let cC2 = Number(current2[1]);
        this.spreadHelper(cR, cC, startingPath, startingQueue, endingPath);
        this.spreadHelper(cR2, cC2, endingPath, endingQueue, startingPath);
        counter++;
      } catch (err) {
        break;
      }
    }

    let max = Math.max(startingQueue.length, endingQueue.length);
    for (let i = 1; i < max; i++) {
      let k = i;
      if (
        startingQueue[k] &&
        startingQueue[k] !== this.state.ending &&
        startingQueue[k] !== this.state.starting
      ) {
        setTimeout(function() {
          let cell = document.getElementById(startingQueue[k]);
          if (cell) {
            cell.className = `${theme}_visited`;
          }
        }, this.state.speed * k);
      }
      if (
        endingQueue[k] &&
        endingQueue[k] !== this.state.ending &&
        endingQueue[k] !== this.state.ending
      ) {
        setTimeout(function() {
          let cell = document.getElementById(endingQueue[k]);
          if (cell) {
            cell.className = `${theme}_visited`;
          }
        }, this.state.speed * k);
      }
    }
    let newState = {...this.state}
    newState.running = false
    this.setState(newState);
  };

  randomSearch = () => {
    let current = this.state.current.split("-");
    let path = {};
    path[this.state.starting] = true;
    const theme = this.state.theme
    const randomHelper = () => {
      let cR = Number(current[0]);
      let cC = Number(current[1]);
      let rightNext = `${cR}-${cC + 1}`;
      let upNext = `${cR - 1}-${cC}`;
      let downNext = `${cR + 1}-${cC}`;
      let leftNext = `${cR}-${cC - 1}`;
      let rightCell = document.getElementById(rightNext);
      let upCell = document.getElementById(upNext);
      let downCell = document.getElementById(downNext);
      let leftCell = document.getElementById(leftNext);

      path[`${cR}-${cC}`] = true;
      const direction = Math.floor(Math.random() * 4);
      setTimeout(() => {
        const currentCell = document.getElementById(`${cR}-${cC}`);
        if (currentCell.className !== `${theme}_starting`) {
          currentCell.className = `${theme}_visited`;
        }
        if (leftCell && leftCell.className === `${theme}_ending`) {
          return;
        }
        if (rightCell && rightCell.className === `${theme}_ending`) {
          return;
        }
        if (downCell && downCell.className === `${theme}_ending`) {
          return;
        }
        if (upCell && upCell.className === `${theme}_ending`) {
          return;
        }
        if (
          direction === 0 &&
          upCell &&
          upCell.className === `${theme}_unvisited` &&
          !path[upNext]
        ) {
          current = upNext.split("-");
          randomHelper();
        } else if (
          direction === 1 &&
          downCell &&
          downCell.className === `${theme}_unvisited` &&
          !path[downNext]
        ) {
          current = downNext.split("-");
          randomHelper();
        } else if (
          direction === 2 &&
          leftCell &&
          leftCell.className === `${theme}_unvisited` &&
          !path[leftNext]
        ) {
          current = leftNext.split("-");
          randomHelper();
        } else if (
          direction === 3 &&
          rightCell &&
          rightCell.className === `${theme}_unvisited` &&
          !path[rightNext]
        ) {
          current = rightNext.split("-");
          randomHelper();
        } else {
          const potentialPaths = Object.keys(path);
          for (let i = potentialPaths.length - 1; i >= 0; i--) {
            current = potentialPaths[i].split("-");
            cR = Number(current[0]);
            cC = Number(current[1]);
            rightNext = `${cR}-${cC + 1}`;
            leftNext = `${cR}-${cC - 1}`;
            rightCell = document.getElementById(rightNext);
            leftCell = document.getElementById(leftNext);
            upNext = `${cR - 1}-${cC}`;
            downNext = `${cR + 1}-${cC}`;
            upCell = document.getElementById(upNext);
            downCell = document.getElementById(downNext);
            if (
              rightCell &&
              rightCell.className === `${theme}_unvisited` &&
              !path[rightNext]
            ) {
              current = rightNext.split("-");
              return randomHelper();
            }
            if (
              leftCell &&
              leftCell.className === `${theme}_unvisited` &&
              !path[leftNext]
            ) {
              current = leftNext.split("-");
              return randomHelper();
            }
            if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
              current = upNext.split("-");
              return randomHelper();
            }
            if (
              downCell &&
              downCell.className === `${theme}_unvisited` &&
              !path[downNext]
            ) {
              current = downNext.split("-");
              return randomHelper();
            }
          }
          if(
            (!upCell || upCell.className === `${theme}_wall` || upCell.className === `${theme}_starting` || upCell.className === `${theme}_visited`)
            &&
            (!downCell || downCell.className === `${theme}_wall` || downCell.className === `${theme}_starting` || downCell.className === `${theme}_visited`)
            &&
            (!leftCell || leftCell.className === `${theme}_wall` || leftCell.className === `${theme}_starting` || leftCell.className === `${theme}_visited`)
            &&
            (!rightCell || rightCell.className === `${theme}_wall` || rightCell.className === `${theme}_starting` || rightCell.className === `${theme}_visited`)
          ){
            return this.cannotFindDuck()
          }
        }
      }, this.state.speed);
    };
    randomHelper();
  };

  linearSearch = () => {
    const theme = this.state.theme
    let current = this.state.current.split("-");
    let path = {};
    path[this.state.starting] = true;
    const linearHelper = () => {
      let cR = Number(current[0]);
      let cC = Number(current[1]);

      let upNext = `${cR - 1}-${cC}`;
      let downNext = `${cR + 1}-${cC}`;
      let leftNext = `${cR}-${cC - 1}`;
      let rightNext = `${cR}-${cC + 1}`;
      let currentCell = document.getElementById(`${cR}-${cC}`);
      let upCell = document.getElementById(upNext);
      let downCell = document.getElementById(downNext);
      let leftCell = document.getElementById(leftNext);
      let rightCell = document.getElementById(rightNext);

      setTimeout(() => {
        //change to .includes to check against theme change
        if (currentCell.className !== `${theme}_starting`) {
          currentCell.className = `${theme}_visited`;
        }

        if (leftCell && leftCell.className === `${theme}_ending`) {
          return;
        }
        if (rightCell && rightCell.className === `${theme}_ending`) {
          return;
        }
        if (downCell && downCell.className === `${theme}_ending`) {
          return;
        }
        if (upCell && upCell.className === `${theme}_ending`) {
          return;
        }
        if (leftCell && leftCell.className === `${theme}_unvisited` && !path[leftNext]) {
          current = leftNext.split("-");
          path[leftNext] = true;
          linearHelper();
        } else if (
          !leftCell ||
          leftCell.className === `${theme}_wall` ||
          leftCell.className === `${theme}_visited` ||
          leftCell.className === `${theme}_starting` ||
          path[leftNext]
        ) {
          if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
            current = upNext.split("-");
            path[upNext] = true;
            linearHelper();
          } else if (
            downCell &&
            downCell.className === `${theme}_unvisited` &&
            !path[downNext]
          ) {
            current = downNext.split("-");
            path[downNext] = true;
            linearHelper();
          } else if (
            rightCell &&
            rightCell.className === `${theme}_unvisited` &&
            !path[rightNext]
          ) {
            current = rightNext.split("-");
            path[rightNext] = true;
            linearHelper();
          } else {
            const potentialPaths = Object.keys(path);
            for (let i = 0; i < potentialPaths.length; i++) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              rightNext = `${cR}-${cC + 1}`;
              upNext = `${cR - 1}-${cC}`;
              downNext = `${cR + 1}-${cC}`;
              leftNext = `${cR}-${cC - 1}`;
              rightCell = document.getElementById(rightNext);

              upCell = document.getElementById(upNext);
              downCell = document.getElementById(downNext);
              leftCell = document.getElementById(leftNext);
              currentCell = document.getElementById(`${cR}-${cC}`);

              if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
                current = upNext.split("-");
                path[upNext] = true;
                return linearHelper();
              } else if (
                downCell &&
                downCell.className === `${theme}_unvisited` &&
                !path[downNext]
              ) {
                current = downNext.split("-");
                path[downNext] = true;
                return linearHelper();
              } else if (
                leftCell &&
                leftCell.className === `${theme}_unvisited` &&
                !path[leftNext]
              ) {
                current = leftNext.split("-");
                path[leftNext] = true;
                return linearHelper();
              } else if (
                rightCell &&
                rightCell.className === `${theme}_unvisited` &&
                !path[rightNext]
              ) {
                current = rightNext.split("-");
                path[rightNext] = true;
                return linearHelper();
              }
            }
          }
        }
        if(
          (!upCell || upCell.className === `${theme}_wall` || upCell.className === `${theme}_starting` || upCell.className === `${theme}_visited`)
          &&
          (!downCell || downCell.className === `${theme}_wall` || downCell.className === `${theme}_starting` || downCell.className === `${theme}_visited`)
          &&
          (!leftCell || leftCell.className === `${theme}_wall` || leftCell.className === `${theme}_starting` || leftCell.className === `${theme}_visited`)
          &&
          (!rightCell || rightCell.className === `${theme}_wall` || rightCell.className === `${theme}_starting` || rightCell.className === `${theme}_visited`)
        ){
          return this.cannotFindDuck()
        }
      }, this.state.speed);
    };
    linearHelper();
  };

  depthFirstSearch = () => {
    let queue = ["17-79"];
    let path = {};
    let counter = 0;
    const ending = this.state.ending
    while (queue[counter] !== ending) {
      try {
        let current = queue[counter].split("-");
        let cR = Number(current[0]);
        let cC = Number(current[1]);
        this.spreadHelper(cR, cC, path, queue);
        counter++;
        if (queue[counter] === ending) {
          break;
        }
      } catch (err) {
        break;
      }
    }
    const theme = this.state.theme

    for (let i = 1; i < queue.length; i++) {
      let k = i;
      if (queue[k] !== ending && queue[k] !== this.state.starting) {
        setTimeout(() => {
          let cell = document.getElementById(queue[k]);
          cell.className = `${theme}_visited`;
          if(k === queue.length-1 && queue[k] !== ending){
            this.cannotFindDuck()
          }
        }, this.state.speed * k);
      }
      if (queue[k] === ending) {
        return
      }
    }
  };

  breadthFirstSearch = () => {
    let queue = [this.state.current];
    let path = {};
    let counter = 0;
    const theme = this.state.theme
    const ending = this.state.ending
    while (queue[counter] !== ending) {
      try {
        let current = queue[counter].split("-");
        let cR = Number(current[0]);
        let cC = Number(current[1]);
        this.spreadHelper(cR, cC, path, queue);
        counter++;
        if (queue[counter] === ending) {
          break;
        }
      } catch (err) {
        break;
      }
    }
    for (let i = 1; i < queue.length; i++) {
      let k = i;
      if (queue[k] !== ending && queue[k] !== this.state.starting) {
        setTimeout(() => {
          let cell = document.getElementById(queue[k]);
          cell.className = `${theme}_visited`;
          if(k === queue.length-1 && queue[k] !== ending){
            this.cannotFindDuck()
          }
        }, this.state.speed * k);
      }
      if (queue[k] === ending) {
        return
      }
    }
  };
  spreadHelper = (cR, cC, path, queue, bidirectionalPath) => {
    let upNext = `${cR - 1}-${cC}`;
    let downNext = `${cR + 1}-${cC}`;
    let leftNext = `${cR}-${cC - 1}`;
    let rightNext = `${cR}-${cC + 1}`;
    let upCell = document.getElementById(upNext);
    let downCell = document.getElementById(downNext);
    let leftCell = document.getElementById(leftNext);
    let rightCell = document.getElementById(rightNext);
    const theme = this.state.theme
    if (bidirectionalPath) {
      let current = `${cR}-${cC}`;
      if (bidirectionalPath[current]) {
        queue.push("crossed");
        path["crossed"] = "crossed";
        return;
      }
    }
    if (rightCell) {
      if (!path[rightNext]) {
        path[rightNext] = true;
        if (rightCell.className !== `${theme}_wall`) {
          queue.push(rightNext);
        }
      }
    }
    if (upCell) {
      if (!path[upNext]) {
        path[upNext] = true;
        if (upCell.className !== `${theme}_wall`) {
          queue.push(upNext);
        }
      }
    }
    if (downCell) {
      if (!path[downNext]) {
        path[downNext] = true;
        if (downCell.className !== `${theme}_wall`) {
          queue.push(downNext);
        }
      }
    }
    if (leftCell) {
      if (!path[leftNext]) {
        path[leftNext] = true;
        if (leftCell.className !== `${theme}_wall`) {
          queue.push(leftNext);
        }
      }
    }
  };

  knownEndPointSearch = () => {
    let current = this.state.current.split("-");
    let path = {};
    let ending = this.state.ending.split("-");
    let eR = ending[0];
    let eC = ending[1];
    path[this.state.starting] = true;
    const theme = this.state.theme
    const knownHelper = () => {
      let cR = Number(current[0]);
      let cC = Number(current[1]);
      if (`${cR}-${cC}` === this.state.ending) {
        return;
      }
      let upNext = `${cR - 1}-${cC}`;
      let downNext = `${cR + 1}-${cC}`;
      let leftNext = `${cR}-${cC - 1}`;
      let rightNext = `${cR}-${cC + 1}`;
      let currentCell = document.getElementById(`${cR}-${cC}`);
      let upCell = document.getElementById(upNext);
      let downCell = document.getElementById(downNext);
      let leftCell = document.getElementById(leftNext);
      let rightCell = document.getElementById(rightNext);

      setTimeout(() => {
        if (currentCell.className !== `${theme}_starting`) {
          currentCell.className = `${theme}_visited`;
        }
        if (leftCell && leftCell.className === `${theme}_ending`) {
          return;
        }
        if (rightCell && rightCell.className === `${theme}_ending`) {
          return;
        }
        if (downCell && downCell.className === `${theme}_ending`) {
          return;
        }
        if (upCell && upCell.className === `${theme}_ending`) {
          return;
        }
        if (cC < eC) {

          if (
            rightCell &&
            rightCell.className === `${theme}_unvisited` &&
            !path[rightNext]
          ) {
            current = rightNext.split("-");
            path[rightNext] = true;
            return knownHelper();
          } else {
            const potentialPaths = Object.keys(path);
            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              rightNext = `${cR}-${cC + 1}`;
              rightCell = document.getElementById(rightNext);
              if (
                rightCell &&
                rightCell.className === `${theme}_unvisited` &&
                !path[rightNext]
              ) {
                current = rightNext.split("-");
                path[rightNext] = true;
                return knownHelper();
              }
            }

            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              rightNext = `${cR}-${cC + 1}`;
              rightCell = document.getElementById(rightNext);
              upNext = `${cR - 1}-${cC}`;
              downNext = `${cR + 1}-${cC}`;
              upCell = document.getElementById(upNext);
              downCell = document.getElementById(downNext);
              if (
                rightCell &&
                rightCell.className === `${theme}_unvisited` &&
                !path[rightNext]
              ) {
                current = rightNext.split("-");
                path[rightNext] = true;
                return knownHelper();
              }
              if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
                current = upNext.split("-");
                path[upNext] = true;
                return knownHelper();
              }
              if (
                downCell &&
                downCell.className === `${theme}_unvisited` &&
                !path[downNext]
              ) {
                current = downNext.split("-");
                path[downNext] = true;
                return knownHelper();
              }
            }

            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              leftNext = `${cR}-${cC - 1}`;
              leftCell = document.getElementById(leftNext);
              if (
                leftCell &&
                leftCell.className === `${theme}_unvisited` &&
                !path[leftNext]
              ) {
                current = leftNext.split("-");
                path[leftNext] = true;
                return knownHelper();
              }
            }
          }
        } else if (cC > eC) {
          if (
            leftCell &&
            leftCell.className === `${theme}_unvisited` &&
            !path[leftNext]
          ) {
            current = leftNext.split("-");
            path[leftNext] = true;
            return knownHelper();
          } else {
            const potentialPaths = Object.keys(path);
            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              upNext = `${cR - 1}-${cC}`;
              downNext = `${cR + 1}-${cC}`;
              upCell = document.getElementById(upNext);
              downCell = document.getElementById(downNext);
              leftNext = `${cR}-${cC - 1}`;
              leftCell = document.getElementById(leftNext);
              if (
                leftCell &&
                leftCell.className === `${theme}_unvisited` &&
                !path[leftNext]
              ) {
                current = leftNext.split("-");
                path[leftNext] = true;
                return knownHelper();
              }
              if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
                current = upNext.split("-");
                path[upNext] = true;
                return knownHelper();
              }
              if (
                downCell &&
                downCell.className === `${theme}_unvisited` &&
                !path[downNext]
              ) {
                current = downNext.split("-");
                path[downNext] = true;
                return knownHelper();
              }
            }

            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              rightNext = `${cR}-${cC + 1}`;
              rightCell = document.getElementById(rightNext);
              if (
                rightCell &&
                rightCell.className === `${theme}_unvisited` &&
                !path[rightNext]
              ) {
                current = rightNext.split("-");
                path[rightNext] = true;
                return knownHelper();
              }
            }
          }
        }
        if (cR > eR) {
          if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
            current = upNext.split("-");
            path[upNext] = true;
            return knownHelper();
          } else {
            const potentialPaths = Object.keys(path);

            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              upNext = `${cR - 1}-${cC}`;
              upCell = document.getElementById(upNext);
              if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
                current = upNext.split("-");
                path[upNext] = true;
                return knownHelper();
              }
            }

            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              leftNext = `${cR}-${cC - 1}`;
              leftCell = document.getElementById(leftNext);
              rightNext = `${cR}-${cC + 1}`;
              rightCell = document.getElementById(rightNext);
              downNext = `${cR + 1}-${cC}`;
              downCell = document.getElementById(downNext);

              if (
                leftCell &&
                leftCell.className === `${theme}_unvisited` &&
                !path[leftNext]
              ) {
                current = leftNext.split("-");
                path[leftNext] = true;
                return knownHelper();
              } else if (
                rightCell &&
                rightCell.className === `${theme}_unvisited` &&
                !path[rightNext]
              ) {
                current = rightNext.split("-");
                path[rightNext] = true;
                return knownHelper();
              }
            }
            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              downNext = `${cR + 1}-${cC}`;
              downCell = document.getElementById(downNext);
              if (
                downCell &&
                downCell.className === `${theme}_unvisited` &&
                !path[downNext]
              ) {
                current = downNext.split("-");
                path[downNext] = true;
                return knownHelper();
              }
            }
          }
        } else if (cR < eR) {
          if (
            downCell &&
            downCell.className === `${theme}_unvisited` &&
            !path[downNext]
          ) {
            current = downNext.split("-");
            path[downNext] = true;
            return knownHelper();
          } else {
            const potentialPaths = Object.keys(path);
            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              downNext = `${cR + 1}-${cC}`;
              downCell = document.getElementById(downNext);
              if (
                downCell &&
                downCell.className === `${theme}_unvisited` &&
                !path[downNext]
              ) {
                current = downNext.split("-");
                path[downNext] = true;
                return knownHelper();
              }
            }

            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              leftNext = `${cR}-${cC - 1}`;
              leftCell = document.getElementById(leftNext);
              rightNext = `${cR}-${cC + 1}`;
              rightCell = document.getElementById(rightNext);
              if (
                leftCell &&
                leftCell.className === `${theme}_unvisited` &&
                !path[leftNext]
              ) {
                current = leftNext.split("-");
                path[leftNext] = true;
                return knownHelper();
              } else if (
                rightCell &&
                rightCell.className === `${theme}_unvisited` &&
                !path[rightNext]
              ) {
                current = rightNext.split("-");
                path[rightNext] = true;
                return knownHelper();
              }
            }
            for (let i = potentialPaths.length - 1; i >= 0; i--) {
              current = potentialPaths[i].split("-");
              cR = Number(current[0]);
              cC = Number(current[1]);
              upNext = `${cR - 1}-${cC}`;
              upCell = document.getElementById(upNext);
              if (upCell && upCell.className === `${theme}_unvisited` && !path[upNext]) {
                current = upNext.split("-");
                path[upNext] = true;
                return knownHelper();
              }
            }
          }
        }
        if(
          (!upCell || upCell.className === `${theme}_wall` || upCell.className === `${theme}_starting` || upCell.className === `${theme}_visited`)
          &&
          (!downCell || downCell.className === `${theme}_wall` || downCell.className === `${theme}_starting` || downCell.className === `${theme}_visited`)
          &&
          (!leftCell || leftCell.className === `${theme}_wall` || leftCell.className === `${theme}_starting` || leftCell.className === `${theme}_visited`)
          &&
          (!rightCell || rightCell.className === `${theme}_wall` || rightCell.className === `${theme}_starting` || rightCell.className === `${theme}_visited`)
        ){
          return this.cannotFindDuck()
        }

      }, this.state.speed);
    };

    knownHelper();
  };

  render() {
    return (
      <TableContext.Provider
        value={{
          ...this.state,
          changeEndpoint: this.changeEndpoint,
          clearBoard: this.clearBoard,
          wallConstructorOn: this.wallConstructorOn,
          wallConstructorOff: this.wallConstructorOff,
          wallBuilding: this.wallBuilding,
          buildMaze: this.buildMaze,
          randomlyGeneratedMaze: this.randomlyGeneratedMaze,
          selectAlgorithm: this.selectAlgorithm,
          go: this.go,
          setSpeed: this.setSpeed,
          setTheme: this.setTheme,
          setRunning:this.setRunning,
          cannotFindDuck:this.cannotFindDuck
        }}
      >
        {this.props.children}
      </TableContext.Provider>
    );
  }
}