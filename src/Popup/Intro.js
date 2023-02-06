/* eslint-disable */
import React, { useState, useEffect } from "react";
import Page_1 from "./Page_1";
import Page_2 from "./Page_2";
import Page_3 from "./Page_3";
import Page_4 from "./Page_4";
import Page_5 from "./Page_5";
import Page_6 from "./Page_6";
import Page_7 from "./Page_7";

const Intro = ({ setIntro }) => {
  const [showIntro, setShowIntro] = useState(false);
  const [count, setCount] = useState(0);
  const [censored, setCensorship] = useState(false);

  useEffect(()=>{
    const dtdToken = localStorage.getItem('dtdIntro')
    if(!dtdToken){
      localStorage.setItem('dtdIntro', 'true')
      setShowIntro(prev => !prev)
    }
  },[])
  const pages = [
    <Page_1 censored={censored} />,
    <Page_2 censored={censored} />,
    <Page_3 censored={censored} />,
    <Page_4 censored={censored} />,
    <Page_5 censored={censored} />,
    <Page_6 censored={censored} />,
    <Page_7 censored={censored} />
  ];
  const currentPage = pages[count];

  const increment = () => {
    if (count + 1 !== pages.length) {
      setCount(count + 1);
    }
  };
  const decrement = () => {
    if (count - 1 >= 0) {
      setCount(count - 1);
    }
  };

  return (
    showIntro &&
    <div className={"intro"}>
      <div className={"intro-current"}>
        {currentPage}
        <div className={"intro-button-container"}>
          <div>
            <button className={"intro-button"} onClick={() => setIntro(false)}>
              Close
            </button>
          </div>
          <div>
            {count !== 0 &&
            <button className={"intro-button"} onClick={() => decrement()}>
              Previous
            </button>
            }
            {count !== 6 &&
            <button className={"intro-button"} onClick={() => increment()}>
              Next
            </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default Intro;
