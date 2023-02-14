const BIDIRECTIONAL_SEARCH = 'bidirectionalSearch'
const CHECKER = 'checker'
const VISITED = "visited"
const STAIR = 'stair'
const SPIRAL = 'spiral'
const BASIC = 'basic'
const FOREST = 'forest'

export const isDuckFound = (selectedAlgo,selectedMaze,setRunning,theme,running) =>{
  switch(selectedAlgo){
    case BIDIRECTIONAL_SEARCH :{
      switch(selectedMaze){
        case CHECKER:{
          const middleC_left = 38
          const middleC_right = 39
          window.checkWallInterval = setInterval(()=>{
            const cellOneID = `16-${middleC_left}`
            const cellTwoID = `16-${middleC_right}`
            const cellOne = document.getElementById(cellOneID);
            const cellTwo = document.getElementById(cellTwoID);
            if(cellOne.className === `${theme}_${VISITED}` && cellTwo.className === `${theme}_${VISITED}`){
              clearInterval(window.checkWallInterval)
              return setRunning(false)
            }
          }, 2000)
          break;
        }
        case STAIR:{
          const middleC_left = 45
          const middleC_right = 46
          window.checkWallInterval = setInterval(()=>{
            const cellOneID = `8-${middleC_left}`
            const cellTwoID = `8-${middleC_right}`
            const cellOne = document.getElementById(cellOneID);
            const cellTwo = document.getElementById(cellTwoID);
            if(cellOne.className === `${theme}_${VISITED}` && cellTwo.className === `${theme}_${VISITED}`){
              clearInterval(window.checkWallInterval)
              return setRunning(false)
            }
          }, 2000)
          break;
        }
        case SPIRAL:{
          const middleC_left = 3
          const middleC_right = 4
          window.checkWallInterval = setInterval(()=>{
            const cellOneID = `27-${middleC_left}`
            const cellTwoID = `27-${middleC_right}`
            const cellOne = document.getElementById(cellOneID);
            const cellTwo = document.getElementById(cellTwoID);
            if(cellOne.className === `${theme}_${VISITED}` && cellTwo.className === `${theme}_${VISITED}`){
              clearInterval(window.checkWallInterval)
              return setRunning(false)
            }
          }, 2000)
          break;
        }
        case BASIC :{
          const middleC_left = 37
          const middleC_right = 38
          window.checkWallInterval = setInterval(()=>{
            const cellOneID = `26-${middleC_left}`
            const cellTwoID = `26-${middleC_right}`
            const cellOne = document.getElementById(cellOneID);
            const cellTwo = document.getElementById(cellTwoID);
            if(cellOne.className === `${theme}_${VISITED}` && cellTwo.className === `${theme}_${VISITED}`){
              clearInterval(window.checkWallInterval)
              return setRunning(false)
            }
          }, 2000)
          break;
        }
        case FOREST:{
          const middleC_left = 37
          const middleC_right = 38
          window.checkWallInterval = setInterval(()=>{
            const cellOneID = `26-${middleC_left}`
            const cellTwoID = `26-${middleC_right}`
            const cellOne = document.getElementById(cellOneID);
            const cellTwo = document.getElementById(cellTwoID);
            if(cellOne.className === `${theme}_${VISITED}` && cellTwo.className === `${theme}_${VISITED}`){
              clearInterval(window.checkWallInterval)
              return setRunning(false)
            }
          }, 2000)
          break;
        }
        default :{
          const middleC_left = 40
          const middleC_right = 41
          const maxR = 34
          window.checkWallInterval = setInterval(()=>{
            for(let i=0; i<=maxR; i++){
              const cellOneID = `${i}-${middleC_left}`
              const cellTwoID = `${i}-${middleC_right}`
              const cellOne = document.getElementById(cellOneID);
              const cellTwo = document.getElementById(cellTwoID);
              if(cellOne.className === `${theme}_${VISITED}` && cellTwo.className === `${theme}_${VISITED}`){
                clearInterval(window.checkWallInterval)
                return setRunning(false)
              }
            }
          }, 2000)
        }
      }
      break;
    }
    default :{
      const surroundingCells = ['16-64','17-63','17-65','18-64']
      window.checkWallInterval = setInterval(()=>{
        for(let i=0; i<surroundingCells.length; i++){
          const cellID = surroundingCells[i]
          const cell = document.getElementById(cellID);
          if(cell.className === `${theme}_${VISITED}`){
            clearInterval(window.checkWallInterval)
            return setRunning(false)
          }
        }
      }, 2000)
      break;
    }
  }

}